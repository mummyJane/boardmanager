import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const jobManagerRoot = path.join(projectRoot, "job-manager");
const dataRoot = path.join(jobManagerRoot, "data");
const storePath = path.join(dataRoot, "jobs.json");

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

function createJobRecord(store, options) {
  const action = String(options.action ?? "").trim();
  if (!VALID_ACTIONS.has(action)) {
    throw new Error(`Invalid or missing --action. Expected one of: ${Array.from(VALID_ACTIONS).join(", ")}`);
  }

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
    resolution: {
      matchedBoardId: options.board ?? null,
      matchedUnitId: options.unit ?? null,
      matchedFamilyKey: null,
    },
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
    const target = job.request.unitId ?? job.request.boardId ?? job.request.target ?? "unresolved-target";
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
    const job = createJobRecord(store, options);
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
