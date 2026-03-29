import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "..");
const inventoryPath = path.join(projectRoot, "device-manager", "data", "inventory.json");
const contractsRoot = path.join(projectRoot, "job-manager", "contracts");
const reportsRoot = path.join(projectRoot, "job-manager", "reports");
const espPython = path.join(projectRoot, "tools", "espressif", "python_env", "idf5.5_py3.13_env", "Scripts", "python.exe");

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument '${token}'`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function sanitizeSegment(text) {
  return String(text ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function uniqueSorted(values) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort();
}

function parseI2cScanLines(lines) {
  const scans = new Map();
  for (const line of lines) {
    const trimmed = String(line).trim();
    const match = trimmed.match(/^BoardManagerI2CScan:\s+bus=(\S+)\s+observed=(.+)$/);
    if (!match) continue;
    const bus = match[1];
    const observed = match[2] === "none"
      ? []
      : match[2].split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    scans.set(bus, {
      bus,
      observedAddresses: uniqueSorted(observed),
      rawLine: trimmed,
    });
  }
  return scans;
}

async function captureSerialLines(port, durationSeconds) {
  const pythonSnippet = [
    "import serial,time,sys",
    `ser=serial.Serial('${port}',115200,timeout=0.2)`,
    `end=time.time()+${Number(durationSeconds)}`,
    "chunks=[]",
    "while time.time()<end:",
    " data=ser.read(4096)",
    " if data: chunks.append(data)",
    " time.sleep(0.05)",
    "ser.close()",
    "sys.stdout.buffer.write(b''.join(chunks))"
  ].join("\n");

  const { stdout } = await execFileAsync(espPython, ["-c", pythonSnippet], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  return String(stdout).split(/\r?\n/).filter(Boolean);
}

function normalizeAddressList(values) {
  return uniqueSorted((values ?? []).map((entry) => String(entry).toLowerCase()));
}

function buildIdentity(unit, boardId, port) {
  return {
    boardId,
    boardDisplayName: unit.match?.boardId === boardId ? (unit.match?.boardId ?? boardId) : boardId,
    stableUnitId: unit.identity?.stableKey ?? unit.unitId,
    port,
    transportKind: unit.transport?.kind ?? null,
    chip: unit.observed?.chip ?? null,
    macAddress: unit.observed?.mac ?? unit.identity?.mac ?? null,
    serialNumber: unit.observed?.serialNumber ?? unit.identity?.serialNumber ?? null,
    firmwareApp: unit.observed?.firmwareApp ?? null,
    firmwareVersion: unit.observed?.firmwareVersion ?? null,
    firmwareBuildId: unit.observed?.firmwareBuildId ?? null,
    firmwareBoard: unit.observed?.firmwareBoard ?? null,
    usbVendorId: unit.observed?.vid ?? null,
    usbProductId: unit.observed?.pid ?? null,
  };
}

function buildHealth(lines) {
  return {
    lineCount: lines.length,
    voltages: [],
    temperatures: [],
    warnings: [],
  };
}

function buildChecks(contract, scanMap) {
  const checks = [];
  for (const phase of contract.phases ?? []) {
    for (const check of phase.checks ?? []) {
      if (check.kind === "i2c-scan") {
        const observed = scanMap.get(check.config?.bus ?? "") ?? { observedAddresses: [], rawLine: null };
        const configuredAddresses = normalizeAddressList(check.config?.configuredAddresses ?? []);
        const observedAddresses = normalizeAddressList(observed.observedAddresses ?? []);
        const missingConfigured = configuredAddresses.filter((entry) => !observedAddresses.includes(entry));
        const unexpectedObserved = observedAddresses.filter((entry) => !configuredAddresses.includes(entry));
        checks.push({
          phaseId: phase.phaseId,
          checkId: check.checkId,
          level: phase.level,
          target: phase.target,
          kind: check.kind,
          description: check.description,
          pass: missingConfigured.length === 0 && unexpectedObserved.length === 0,
          passCriteria: check.passCriteria ?? null,
          evidence: {
            source: check.source,
            bus: check.config?.bus ?? null,
            configuredAddresses,
            observedAddresses,
            missingConfigured,
            unexpectedObserved,
            rawLine: observed.rawLine,
          },
          failureNotes: check.failureNotes ?? [],
        });
        continue;
      }

      checks.push({
        phaseId: phase.phaseId,
        checkId: check.checkId,
        level: phase.level,
        target: phase.target,
        kind: check.kind,
        description: check.description,
        pass: null,
        passCriteria: check.passCriteria ?? null,
        evidence: {
          source: check.source,
          config: check.config ?? {},
        },
        failureNotes: check.failureNotes ?? [],
      });
    }
  }
  return checks;
}

function buildReport(boardId, unit, port, contract, scanMap, lines) {
  const checks = buildChecks(contract, scanMap);
  const executedChecks = checks.filter((entry) => entry.pass !== null);
  const failingChecks = executedChecks.filter((entry) => entry.pass === false);

  return {
    reportType: "board-validation-report",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    contractId: contract.contractId,
    identity: buildIdentity(unit, boardId, port),
    source: {
      kind: "serial-capture",
      lineCount: lines.length,
    },
    summary: {
      overallPass: failingChecks.length === 0,
      executedCheckCount: executedChecks.length,
      failingCheckCount: failingChecks.length,
      warningCount: 0,
    },
    health: buildHealth(lines),
    phases: (contract.phases ?? []).map((phase) => ({
      phaseId: phase.phaseId,
      order: phase.order,
      level: phase.level,
      target: phase.target,
      dependsOn: phase.dependsOn ?? [],
    })),
    checks,
    rawCapture: {
      lines,
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const boardId = options.board;
  const unitId = options.unit;
  const durationSeconds = Number(options.seconds ?? 4);

  if (!boardId || !unitId) {
    throw new Error("Missing required --board and --unit arguments.");
  }

  const inventory = await readJson(inventoryPath);
  const unit = (inventory.units ?? []).find((entry) => entry.unitId === unitId || entry.identity?.stableKey === unitId);
  if (!unit) {
    throw new Error(`Unit '${unitId}' was not found in inventory.`);
  }

  const resolvedBoardId = unit.match?.boardId ?? unit.manualOverride?.boardId ?? null;
  if (resolvedBoardId && resolvedBoardId !== boardId) {
    throw new Error(`Unit '${unitId}' currently resolves to board '${resolvedBoardId}', not '${boardId}'.`);
  }

  const contractPath = path.join(contractsRoot, `${boardId}.validation-contract.json`);
  const contract = await readJson(contractPath);
  const port = options.port ?? unit.transport?.port;
  if (!port) {
    throw new Error(`No transport port is available for unit '${unitId}'.`);
  }

  const lines = await captureSerialLines(port, durationSeconds);
  const scanMap = parseI2cScanLines(lines);
  const report = buildReport(boardId, unit, port, contract, scanMap, lines);

  await mkdir(reportsRoot, { recursive: true });
  const reportPath = path.join(reportsRoot, `validation-${sanitizeSegment(boardId)}-${sanitizeSegment(unitId)}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ reportPath, summary: report.summary, failingChecks: report.checks.filter((entry) => entry.pass === false) }, null, 2));
  if (!report.summary.overallPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
