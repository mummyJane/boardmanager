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

function normalizeAddressList(values) {
  return uniqueSorted((values ?? []).map((entry) => String(entry).toLowerCase()));
}

function normalizeBooleanToken(value) {
  if (value === true || value === false) return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "pass", "ok"].includes(normalized)) return true;
  if (["0", "false", "no", "fail", "error"].includes(normalized)) return false;
  return null;
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

function createTelemetry() {
  return {
    firmware: null,
    agent: null,
    controller: {},
    signalSamples: [],
    signalMap: new Map(),
    checkResults: new Map(),
    health: {
      voltages: [],
      temperatures: [],
      warnings: [],
    },
    notes: [],
  };
}

function setCheckResult(telemetry, checkId, pass, evidence) {
  telemetry.checkResults.set(checkId, {
    pass,
    evidence,
  });
}

function setSignalSample(telemetry, signalName, value, source, extra = {}) {
  const sample = {
    signalName,
    value,
    source,
    ...extra,
  };
  telemetry.signalMap.set(signalName, sample);
  telemetry.signalSamples.push(sample);
}

function parseFirmwareLine(line) {
  const match = String(line).trim().match(/^BoardManagerFirmware:\s+app=(\S+)\s+version=(\S+)\s+build=(.+)\s+board=(\S+)$/);
  if (!match) return null;
  return {
    app: match[1],
    version: match[2],
    buildId: match[3],
    board: match[4],
    rawLine: String(line).trim(),
  };
}

function parseAgentLine(line) {
  const match = String(line).trim().match(/^BoardManagerAgent:\s+board=(\S+)\s+app=(\S+)\s+version=(\S+)\s+capabilities=(\S+)\s+build=(.+)$/);
  if (!match) return null;
  return {
    board: match[1],
    app: match[2],
    version: match[3],
    capabilities: match[4] === "none" ? [] : match[4].split(",").filter(Boolean),
    buildId: match[5],
    rawLine: String(line).trim(),
  };
}

function parseGenericCheckLine(line) {
  const match = String(line).trim().match(/^BoardManagerCheck:\s+check=(\S+)\s+pass=(\S+)(?:\s+evidence=(.+))?$/);
  if (!match) return null;
  return {
    checkId: match[1],
    pass: normalizeBooleanToken(match[2]),
    evidenceText: match[3] ?? null,
  };
}

function parseHealthMetricLine(line) {
  const match = String(line).trim().match(/^BoardManagerHealth:\s+kind=(\S+)\s+name=(\S+)\s+value=(\S+)(?:\s+unit=(\S+))?$/);
  if (!match) return null;
  return {
    kind: match[1],
    name: match[2],
    value: Number(match[3]),
    unit: match[4] ?? null,
    rawLine: String(line).trim(),
  };
}

function parseTelemetry(lines, contract) {
  const telemetry = createTelemetry();
  const expectedBoardId = contract.boardId;

  for (const line of lines) {
    const trimmed = String(line).trim();

    const firmware = parseFirmwareLine(trimmed);
    if (firmware) {
      telemetry.firmware = firmware;
      continue;
    }

    const agent = parseAgentLine(trimmed);
    if (agent) {
      telemetry.agent = agent;
      continue;
    }

    const genericCheck = parseGenericCheckLine(trimmed);
    if (genericCheck) {
      if (genericCheck.pass !== null) {
        setCheckResult(telemetry, genericCheck.checkId, genericCheck.pass, {
          source: "BoardManagerCheck",
          text: genericCheck.evidenceText,
          rawLine: trimmed,
        });
      }
      continue;
    }

    const metric = parseHealthMetricLine(trimmed);
    if (metric) {
      const target = metric.kind.startsWith("temp") ? telemetry.health.temperatures : telemetry.health.voltages;
      target.push(metric);
      continue;
    }

    let match = trimmed.match(/^Board init complete for (.+) using (.+)$/);
    if (match) {
      telemetry.controller.displayName = match[1];
      telemetry.controller.platformSdk = match[2];
      telemetry.notes.push(trimmed);
      continue;
    }

    match = trimmed.match(/^controller gpio path:\s+(PASS|FAIL)$/i);
    if (match) {
      telemetry.controller.gpioPathReady = normalizeBooleanToken(match[1]);
      continue;
    }

    match = trimmed.match(/^internal i2c bus:\s+(PASS|FAIL)$/i);
    if (match) {
      setCheckResult(telemetry, "internal_i2c_configured", normalizeBooleanToken(match[1]), {
        source: "dial-self-test",
        rawLine: trimmed,
      });
      continue;
    }

    match = trimmed.match(/^rtc present:\s+(PASS|FAIL)$/i);
    if (match) {
      const pass = normalizeBooleanToken(match[1]);
      setCheckResult(telemetry, "rtc_presence", pass, { source: "dial-self-test", rawLine: trimmed });
      setCheckResult(telemetry, "rtc_hook_i2c_ack", pass, { source: "dial-self-test", rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^touch present:\s+(PASS|FAIL)$/i);
    if (match) {
      const pass = normalizeBooleanToken(match[1]);
      setCheckResult(telemetry, "touch_presence", pass, { source: "dial-self-test", rawLine: trimmed });
      setCheckResult(telemetry, "touch_hook_i2c_ack", pass, { source: "dial-self-test", rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^rfid present:\s+(PASS|FAIL)$/i);
    if (match) {
      const pass = normalizeBooleanToken(match[1]);
      setCheckResult(telemetry, "rfid_presence", pass, { source: "dial-self-test", rawLine: trimmed });
      setCheckResult(telemetry, "rfid_hook_i2c_ack", pass, { source: "dial-self-test", rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^display spi path:\s+(PASS|FAIL)$/i);
    if (match) {
      const pass = normalizeBooleanToken(match[1]);
      setCheckResult(telemetry, "display_spi_configured", pass, { source: "dial-self-test", rawLine: trimmed });
      setCheckResult(telemetry, "display_hook_spi_path", pass, { source: "dial-self-test", rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^display command path:\s+(PASS|FAIL)$/i);
    if (match) {
      const pass = normalizeBooleanToken(match[1]);
      setCheckResult(telemetry, "display_spi_command_path", pass, { source: "dial-self-test", rawLine: trimmed });
      setCheckResult(telemetry, "display_presence", pass, { source: "dial-self-test", rawLine: trimmed });
      setCheckResult(telemetry, "display_hook_display_command", pass, { source: "dial-self-test", rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^touch irq active:\s+(YES|NO)$/i);
    if (match) {
      const value = normalizeBooleanToken(match[1]);
      setSignalSample(telemetry, "touch_interrupt", value ? 1 : 0, "dial-self-test", { rawLine: trimmed });
      setCheckResult(telemetry, "touch_hook_interrupt_idle_sample", true, {
        source: "dial-self-test",
        sampledValue: value ? 1 : 0,
        rawLine: trimmed,
      });
      continue;
    }

    match = trimmed.match(/^rfid irq active:\s+(YES|NO)$/i);
    if (match) {
      const value = normalizeBooleanToken(match[1]);
      setSignalSample(telemetry, "rfid_interrupt", value ? 1 : 0, "dial-self-test", { rawLine: trimmed });
      setCheckResult(telemetry, "rfid_hook_interrupt_idle_sample", true, {
        source: "dial-self-test",
        sampledValue: value ? 1 : 0,
        rawLine: trimmed,
      });
      continue;
    }

    match = trimmed.match(/^encoder phases:\s+A=(\d+)\s+B=(\d+)$/i);
    if (match) {
      setSignalSample(telemetry, "encoder_phase_a", Number(match[1]), "dial-self-test", { rawLine: trimmed });
      setSignalSample(telemetry, "encoder_phase_b", Number(match[2]), "dial-self-test", { rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^Live inputs:\s+touch_irq=(\d+)\s+rfid_irq=(\d+)\s+enc_a=(\d+)\s+enc_b=(\d+)$/);
    if (match) {
      setSignalSample(telemetry, "touch_interrupt", Number(match[1]), "dial-live", { rawLine: trimmed });
      setSignalSample(telemetry, "rfid_interrupt", Number(match[2]), "dial-live", { rawLine: trimmed });
      setSignalSample(telemetry, "encoder_phase_a", Number(match[3]), "dial-live", { rawLine: trimmed });
      setSignalSample(telemetry, "encoder_phase_b", Number(match[4]), "dial-live", { rawLine: trimmed });
      setCheckResult(telemetry, "touch_hook_interrupt_idle_sample", true, { source: "dial-live", sampledValue: Number(match[1]), rawLine: trimmed });
      setCheckResult(telemetry, "rfid_hook_interrupt_idle_sample", true, { source: "dial-live", sampledValue: Number(match[2]), rawLine: trimmed });
      continue;
    }

    match = trimmed.match(/^GNSS PPS input path is mapped as (.+) on (.+)$/);
    if (match) {
      telemetry.controller.gnssPpsSignal = {
        ioName: match[1],
        controllerSignal: match[2],
        rawLine: trimmed,
      };
      continue;
    }

    match = trimmed.match(/^Live GNSS PPS state:\s+(\d+)$/);
    if (match) {
      setSignalSample(telemetry, "gnss_pps", Number(match[1]), "gnss-live", { rawLine: trimmed });
      continue;
    }
  }

  if (telemetry.agent && telemetry.agent.board !== expectedBoardId) {
    telemetry.health.warnings.push(`Board-agent line reported board '${telemetry.agent.board}' instead of expected '${expectedBoardId}'.`);
  }

  return telemetry;
}

function findObservedAddressEvidence(check, scanMap) {
  const bus = check.config?.bus ?? null;
  const address = String(check.config?.deviceConfig?.i2cAddress ?? "").toLowerCase();
  if (!bus || !address) return null;
  const observed = scanMap.get(bus);
  if (!observed) return null;
  const observedAddresses = normalizeAddressList(observed.observedAddresses);
  return {
    bus,
    address,
    observedAddresses,
    pass: observedAddresses.includes(address),
    rawLine: observed.rawLine,
  };
}

function inferCheckResult(contract, check, unit, telemetry, scanMap) {
  const manual = telemetry.checkResults.get(check.checkId);
  if (manual) {
    return {
      pass: manual.pass,
      evidence: manual.evidence,
    };
  }

  if (check.kind === "controller-identity") {
    const pass = (unit.match?.boardId ?? unit.manualOverride?.boardId ?? null) === contract.boardId
      && (!telemetry.agent || telemetry.agent.board === contract.boardId);
    return {
      pass,
      evidence: {
        source: "inventory-and-agent",
        matchedBoardId: unit.match?.boardId ?? null,
        firmwareBoard: telemetry.firmware?.board ?? unit.observed?.firmwareBoard ?? null,
        agentBoard: telemetry.agent?.board ?? null,
        chip: unit.observed?.chip ?? null,
      },
    };
  }

  if (check.kind === "transport-ready") {
    return {
      pass: Boolean(unit.transport?.port),
      evidence: {
        source: "inventory.transport",
        port: unit.transport?.port ?? null,
        transportKind: unit.transport?.kind ?? null,
      },
    };
  }

  if (check.kind === "controller-peripheral-declared") {
    return {
      pass: Array.isArray(check.config?.declared) && check.config.declared.length > 0,
      evidence: {
        source: "contract.config",
        family: check.config?.family ?? null,
        declared: check.config?.declared ?? [],
      },
    };
  }

  if (check.kind === "bus-configured") {
    if (check.config?.kind === "i2c") {
      const observed = scanMap.get(check.config?.bus ?? "");
      return {
        pass: Boolean(observed),
        evidence: {
          source: observed ? "BoardManagerI2CScan" : "contract.config",
          bus: check.config?.bus ?? null,
          observedAddresses: observed?.observedAddresses ?? [],
          rawLine: observed?.rawLine ?? null,
        },
      };
    }
    return null;
  }

  if (check.kind === "i2c-scan") {
    const observed = scanMap.get(check.config?.bus ?? "") ?? { observedAddresses: [], rawLine: null };
    const configuredAddresses = normalizeAddressList(check.config?.configuredAddresses ?? []);
    const observedAddresses = normalizeAddressList(observed.observedAddresses ?? []);
    const missingConfigured = configuredAddresses.filter((entry) => !observedAddresses.includes(entry));
    const unexpectedObserved = observedAddresses.filter((entry) => !configuredAddresses.includes(entry));
    return {
      pass: missingConfigured.length === 0 && unexpectedObserved.length === 0,
      evidence: {
        source: check.source,
        bus: check.config?.bus ?? null,
        configuredAddresses,
        observedAddresses,
        missingConfigured,
        unexpectedObserved,
        rawLine: observed.rawLine,
      },
    };
  }

  if (check.kind === "device-presence" || check.kind === "device-i2c-ack") {
    const observed = findObservedAddressEvidence(check, scanMap);
    if (!observed) return null;
    return {
      pass: observed.pass,
      evidence: {
        source: "BoardManagerI2CScan",
        bus: observed.bus,
        expectedAddress: observed.address,
        observedAddresses: observed.observedAddresses,
        rawLine: observed.rawLine,
      },
    };
  }

  if (check.kind === "signal-read") {
    const sample = telemetry.signalMap.get(check.config?.signal ?? "");
    if (!sample) return null;
    return {
      pass: true,
      evidence: {
        source: sample.source,
        signal: sample.signalName,
        sampledValue: sample.value,
        rawLine: sample.rawLine ?? null,
      },
    };
  }

  return null;
}

function buildIdentity(unit, contract, port, telemetry) {
  return {
    boardId: contract.boardId,
    boardDisplayName: contract.displayName ?? contract.boardId,
    stableUnitId: unit.identity?.stableKey ?? unit.unitId,
    port,
    transportKind: unit.transport?.kind ?? null,
    chip: unit.observed?.chip ?? null,
    macAddress: unit.observed?.mac ?? unit.identity?.mac ?? null,
    serialNumber: unit.observed?.serialNumber ?? unit.identity?.serialNumber ?? unit.observed?.usbBaseSerialNumber ?? null,
    firmwareApp: telemetry.firmware?.app ?? unit.observed?.firmwareApp ?? null,
    firmwareVersion: telemetry.firmware?.version ?? unit.observed?.firmwareVersion ?? null,
    firmwareBuildId: telemetry.firmware?.buildId ?? unit.observed?.firmwareBuildId ?? null,
    firmwareBoard: telemetry.firmware?.board ?? telemetry.agent?.board ?? unit.observed?.firmwareBoard ?? null,
    usbVendorId: unit.observed?.vid ?? null,
    usbProductId: unit.observed?.pid ?? null,
  };
}

function buildFacts(unit, contract, telemetry) {
  return {
    controller: {
      moduleId: contract.phases?.find((phase) => phase.level === "controller")?.target ?? null,
      displayName: telemetry.controller.displayName ?? contract.displayName ?? null,
      platformSdk: telemetry.controller.platformSdk ?? contract.platformSdk ?? null,
      gpioPathReady: telemetry.controller.gpioPathReady ?? null,
      gnssPpsSignal: telemetry.controller.gnssPpsSignal ?? null,
    },
    firmware: {
      firmwareLine: telemetry.firmware?.rawLine ?? null,
      agentLine: telemetry.agent?.rawLine ?? null,
      app: telemetry.firmware?.app ?? telemetry.agent?.app ?? unit.observed?.firmwareApp ?? null,
      version: telemetry.firmware?.version ?? telemetry.agent?.version ?? unit.observed?.firmwareVersion ?? null,
      buildId: telemetry.firmware?.buildId ?? telemetry.agent?.buildId ?? unit.observed?.firmwareBuildId ?? null,
      board: telemetry.firmware?.board ?? telemetry.agent?.board ?? unit.observed?.firmwareBoard ?? null,
      capabilities: telemetry.agent?.capabilities ?? unit.observed?.agentCapabilities ?? [],
    },
    identity: {
      stableUnitId: unit.identity?.stableKey ?? unit.unitId,
      matchedBoardId: unit.match?.boardId ?? null,
      chip: unit.observed?.chip ?? null,
      macAddress: unit.observed?.mac ?? unit.identity?.mac ?? null,
      serialNumber: unit.observed?.serialNumber ?? unit.identity?.serialNumber ?? unit.observed?.usbBaseSerialNumber ?? null,
    },
    signals: telemetry.signalSamples,
    notes: telemetry.notes,
  };
}

function buildHealth(lines, telemetry) {
  return {
    lineCount: lines.length,
    voltages: telemetry.health.voltages,
    temperatures: telemetry.health.temperatures,
    warnings: telemetry.health.warnings,
  };
}

function buildChecks(contract, unit, telemetry, scanMap) {
  const checks = [];
  for (const phase of contract.phases ?? []) {
    for (const check of phase.checks ?? []) {
      const inferred = inferCheckResult(contract, check, unit, telemetry, scanMap);
      checks.push({
        phaseId: phase.phaseId,
        checkId: check.checkId,
        level: phase.level,
        target: phase.target,
        kind: check.kind,
        description: check.description,
        pass: inferred ? inferred.pass : null,
        passCriteria: check.passCriteria ?? null,
        evidence: inferred ? inferred.evidence : {
          source: check.source,
          config: check.config ?? {},
        },
        failureNotes: check.failureNotes ?? [],
      });
    }
  }
  return checks;
}

function buildReport(contract, unit, port, scanMap, lines, telemetry) {
  const checks = buildChecks(contract, unit, telemetry, scanMap);
  const executedChecks = checks.filter((entry) => entry.pass !== null);
  const failingChecks = executedChecks.filter((entry) => entry.pass === false);
  const health = buildHealth(lines, telemetry);

  return {
    reportType: "board-validation-report",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    contractId: contract.contractId,
    identity: buildIdentity(unit, contract, port, telemetry),
    source: {
      kind: "serial-capture",
      lineCount: lines.length,
    },
    summary: {
      overallPass: failingChecks.length === 0,
      executedCheckCount: executedChecks.length,
      failingCheckCount: failingChecks.length,
      warningCount: health.warnings.length,
    },
    health,
    facts: buildFacts(unit, contract, telemetry),
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
  const telemetry = parseTelemetry(lines, contract);
  const report = buildReport(contract, unit, port, scanMap, lines, telemetry);

  await mkdir(reportsRoot, { recursive: true });
  const reportPath = path.join(reportsRoot, `validation-${sanitizeSegment(boardId)}-${sanitizeSegment(unitId)}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    reportPath,
    summary: report.summary,
    health: report.health,
    facts: report.facts,
    failingChecks: report.checks.filter((entry) => entry.pass === false),
  }, null, 2));
  if (!report.summary.overallPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});