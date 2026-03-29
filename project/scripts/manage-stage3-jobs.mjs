import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const jobManagerRoot = path.join(projectRoot, "job-manager");
const dataRoot = path.join(jobManagerRoot, "data");
const storePath = path.join(dataRoot, "jobs.json");
const deviceManagerRoot = path.join(projectRoot, "device-manager");
const inventoryPath = path.join(deviceManagerRoot, "data", "inventory.json");
const historyPath = path.join(deviceManagerRoot, "data", "unit-history.json");

const VALID_ACTIONS = new Set(["validate", "build", "program", "run", "debug"]);
const VALID_STATUSES = new Set(["queued", "running", "succeeded", "failed", "canceled"]);

function usage() {
  console.log(`Usage:
  node project/scripts/manage-stage3-jobs.mjs create --action <validate|build|program|run|debug> [--board <id>] [--unit <stableKey>] [--target <name>] [--firmware-target <name>] [--app <id>] [--platform <esp32|stm32>] [--transport <serial|stlink|usb-jtag>] [--reason <text>]
  node project/scripts/manage-stage3-jobs.mjs list [--status <status>] [--action <action>] [--format <text|json>]
  node project/scripts/manage-stage3-jobs.mjs update --job <jobId> --status <queued|running|succeeded|failed|canceled> [--summary <text>]
`);
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument '${token}'`);
    }
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function ensureStore() {
  await mkdir(dataRoot, { recursive: true });
  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      generatedAt: null,
      nextJobSequence: 1,
      jobs: [],
    };
  }
}

async function saveStore(store) {
  store.generatedAt = new Date().toISOString();
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function loadResolutionSources() {
  const [inventory, history] = await Promise.all([
    readJson(inventoryPath, { units: [] }),
    readJson(historyPath, { units: [] }),
  ]);

  const inventoryUnits = Array.isArray(inventory.units) ? inventory.units : [];
  const historyUnits = Array.isArray(history.units) ? history.units : [];
  return { inventoryUnits, historyUnits };
}

function findInventoryUnit(inventoryUnits, stableKey) {
  return inventoryUnits.find((unit) => unit.unitId === stableKey || unit.identity?.stableKey === stableKey) ?? null;
}

function findHistoryUnit(historyUnits, stableKey) {
  return historyUnits.find((unit) => unit.stableKey === stableKey || unit.identity?.stableKey === stableKey) ?? null;
}

function collectBoardIds(inventoryUnit, historyUnit) {
  const boardIds = new Set();
  if (inventoryUnit?.match?.boardId) boardIds.add(inventoryUnit.match.boardId);
  if (inventoryUnit?.manualOverride?.boardId) boardIds.add(inventoryUnit.manualOverride.boardId);
  for (const boardId of historyUnit?.boardIds ?? []) {
    if (boardId) boardIds.add(boardId);
  }
  return Array.from(boardIds);
}

function resolveFromUnit(inventoryUnits, historyUnits, unitId, requestedBoardId) {
  const inventoryUnit = findInventoryUnit(inventoryUnits, unitId);
  if (!inventoryUnit) {
    throw new Error(`Unit '${unitId}' was not found in the current inventory.`);
  }

  const historyUnit = findHistoryUnit(historyUnits, inventoryUnit.identity?.stableKey ?? inventoryUnit.unitId);
  const candidateBoardIds = collectBoardIds(inventoryUnit, historyUnit);
  const matchedBoardId = requestedBoardId ?? inventoryUnit.manualOverride?.boardId ?? inventoryUnit.match?.boardId ?? historyUnit?.boardIds?.[0] ?? null;

  if (requestedBoardId && matchedBoardId !== requestedBoardId) {
    throw new Error(`Unit '${unitId}' does not currently resolve to board '${requestedBoardId}'.`);
  }

  if (requestedBoardId && candidateBoardIds.length > 0 && !candidateBoardIds.includes(requestedBoardId)) {
    throw new Error(`Requested board '${requestedBoardId}' conflicts with observed history for unit '${unitId}'. Known boards: ${candidateBoardIds.join(", ")}`);
  }

  return {
    matchedBoardId,
    matchedUnitId: inventoryUnit.identity?.stableKey ?? inventoryUnit.unitId,
    matchedFamilyKey: historyUnit?.familyKey ?? inventoryUnit.history?.familyKey ?? null,
    matchedProfileId: historyUnit?.profileId ?? inventoryUnit.history?.profileId ?? null,
    resolvedTransportKind: inventoryUnit.transport?.kind ?? null,
    resolvedTransportPort: inventoryUnit.transport?.port ?? null,
    source: requestedBoardId ? "board+unit" : "unit",
    present: true,
    boardCandidates: candidateBoardIds,
  };
}

function resolveFromBoardOnly(inventoryUnits, historyUnits, boardId) {
  const matchingUnits = inventoryUnits.filter((unit) => unit.match?.boardId === boardId || unit.manualOverride?.boardId === boardId);

  if (matchingUnits.length === 0) {
    return {
      matchedBoardId: boardId,
      matchedUnitId: null,
      matchedFamilyKey: `board:${boardId}`,
      matchedProfileId: null,
      resolvedTransportKind: null,
      resolvedTransportPort: null,
      source: "board-only",
      present: false,
      boardCandidates: [boardId],
    };
  }

  if (matchingUnits.length > 1) {
    const unitIds = matchingUnits.map((unit) => unit.identity?.stableKey ?? unit.unitId);
    throw new Error(`Board '${boardId}' matches multiple present units: ${unitIds.join(", ")}. Select a stable unit id explicitly.`);
  }

  const chosenUnit = matchingUnits[0];
  const stableKey = chosenUnit.identity?.stableKey ?? chosenUnit.unitId;
  const historyUnit = findHistoryUnit(historyUnits, stableKey);
  return {
    matchedBoardId: boardId,
    matchedUnitId: stableKey,
    matchedFamilyKey: historyUnit?.familyKey ?? chosenUnit.history?.familyKey ?? `board:${boardId}`,
    matchedProfileId: historyUnit?.profileId ?? chosenUnit.history?.profileId ?? null,
    resolvedTransportKind: chosenUnit.transport?.kind ?? null,
    resolvedTransportPort: chosenUnit.transport?.port ?? null,
    source: "board-only-single-present-unit",
    present: true,
    boardCandidates: [boardId],
  };
}

async function resolveRequest(options) {
  const requestedBoardId = options.board ?? null;
  const requestedUnitId = options.unit ?? null;
  const { inventoryUnits, historyUnits } = await loadResolutionSources();

  if (requestedUnitId) {
    return resolveFromUnit(inventoryUnits, historyUnits, requestedUnitId, requestedBoardId);
  }

  if (requestedBoardId) {
    return resolveFromBoardOnly(inventoryUnits, historyUnits, requestedBoardId);
  }

  return {
    matchedBoardId: null,
    matchedUnitId: null,
    matchedFamilyKey: null,
    matchedProfileId: null,
    resolvedTransportKind: null,
    resolvedTransportPort: null,
    source: "request-only",
    present: false,
    boardCandidates: [],
  };
}

async function createJobRecord(store, options) {
  const action = String(options.action ?? "").trim();
  if (!VALID_ACTIONS.has(action)) {
    throw new Error(`Invalid or missing --action. Expected one of: ${Array.from(VALID_ACTIONS).join(", ")}`);
  }

  const resolution = await resolveRequest(options);
  const jobSequence = Number(store.nextJobSequence ?? 1);
  const jobId = `job-${String(jobSequence).padStart(6, "0")}`;
  const createdAt = new Date().toISOString();

  return {
    jobId,
    action,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
    request: {
      boardId: options.board ?? null,
      unitId: options.unit ?? null,
      target: options.target ?? null,
      firmwareTarget: options["firmware-target"] ?? null,
      appId: options.app ?? null,
      platform: options.platform ?? null,
      transport: options.transport ?? null,
      reason: options.reason ?? null,
    },
    resolution,
    logs: [],
    artifacts: [],
    result: {
      summary: null,
      reportPath: null,
      exitCode: null,
      pass: null,
    },
  };
}

function updateJobRecord(job, options) {
  const status = String(options.status ?? "").trim();
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid or missing --status. Expected one of: ${Array.from(VALID_STATUSES).join(", ")}`);
  }

  const now = new Date().toISOString();
  job.status = status;
  job.updatedAt = now;
  if (status === "running" && !job.startedAt) {
    job.startedAt = now;
  }
  if (["succeeded", "failed", "canceled"].includes(status)) {
    job.completedAt = now;
  }
  if (options.summary) {
    job.result.summary = options.summary;
  }
  if (status === "succeeded") {
    job.result.pass = true;
    job.result.exitCode = 0;
  } else if (status === "failed") {
    job.result.pass = false;
  }
  return job;
}

function formatTextJobs(jobs) {
  if (jobs.length === 0) {
    return "No Stage 3 jobs recorded.";
  }

  return jobs.map((job) => {
    const target = job.resolution?.matchedUnitId ?? job.resolution?.matchedBoardId ?? job.request.target ?? "unresolved-target";
    return `${job.jobId} ${job.action} ${job.status} ${target}`;
  }).join("\n");
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!command || options.help) {
    usage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  const store = await ensureStore();

  if (command === "create") {
    const job = await createJobRecord(store, options);
    store.jobs.unshift(job);
    store.nextJobSequence = Number(store.nextJobSequence ?? 1) + 1;
    await saveStore(store);
    console.log(JSON.stringify({ created: true, job }, null, 2));
    return;
  }

  if (command === "list") {
    const filtered = store.jobs.filter((job) => {
      if (options.status && job.status !== options.status) return false;
      if (options.action && job.action !== options.action) return false;
      return true;
    });
    const format = options.format ?? "text";
    if (format === "json") {
      console.log(JSON.stringify({ generatedAt: store.generatedAt, jobCount: filtered.length, jobs: filtered }, null, 2));
      return;
    }
    if (format !== "text") {
      throw new Error(`Unsupported --format '${format}'`);
    }
    console.log(formatTextJobs(filtered));
    return;
  }

  if (command === "update") {
    const jobId = options.job;
    if (!jobId) {
      throw new Error("Missing --job for update command");
    }
    const job = store.jobs.find((entry) => entry.jobId === jobId);
    if (!job) {
      throw new Error(`Job '${jobId}' was not found`);
    }
    updateJobRecord(job, options);
    await saveStore(store);
    console.log(JSON.stringify({ updated: true, job }, null, 2));
    return;
  }

  throw new Error(`Unsupported command '${command}'`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
