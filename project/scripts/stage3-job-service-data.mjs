import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const jobStorePath = path.join(projectRoot, "job-manager", "data", "jobs.json");

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function ensureProjectPath(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  const normalizedRoot = `${projectRoot}${path.sep}`;
  if (resolved === projectRoot || resolved.startsWith(normalizedRoot)) {
    return resolved;
  }
  throw new Error(`Path '${filePath}' is outside the project root.`);
}

async function safeStat(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

async function readTextTail(filePath, tailLines) {
  const content = await readFile(filePath, "utf8");
  const lines = String(content).split(/\r?\n/);
  const filtered = lines.filter((line, index) => !(index === lines.length - 1 && line === ""));
  if (tailLines <= 0 || filtered.length <= tailLines) {
    return filtered;
  }
  return filtered.slice(filtered.length - tailLines);
}

export async function readJobStore() {
  return readJson(jobStorePath, {
    generatedAt: null,
    nextJobSequence: 1,
    jobs: [],
  });
}

export async function getJobsPayload(searchParams) {
  const store = await readJobStore();
  const requestedJob = searchParams.get("job");
  const requestedAction = searchParams.get("action");
  const requestedStatus = searchParams.get("status");
  const limit = parseNumber(searchParams.get("limit"), 50);

  let jobs = Array.isArray(store.jobs) ? [...store.jobs] : [];
  if (requestedJob) {
    jobs = jobs.filter((entry) => entry.jobId === requestedJob);
  }
  if (requestedAction) {
    jobs = jobs.filter((entry) => entry.action === requestedAction);
  }
  if (requestedStatus) {
    jobs = jobs.filter((entry) => entry.status === requestedStatus);
  }
  if (limit > 0) {
    jobs = jobs.slice(0, limit);
  }

  return {
    generatedAt: store.generatedAt ?? null,
    nextJobSequence: store.nextJobSequence ?? 1,
    jobCount: jobs.length,
    jobs,
  };
}

async function requireJob(jobId) {
  const store = await readJobStore();
  const job = (store.jobs ?? []).find((entry) => entry.jobId === jobId);
  if (!job) {
    throw new Error(`Job '${jobId}' was not found.`);
  }
  return job;
}

export async function getJobLogPayload(searchParams) {
  const jobId = searchParams.get("job");
  if (!jobId) {
    throw new Error("Missing required 'job' query parameter.");
  }

  const requestedKind = searchParams.get("kind");
  const tailLines = parseNumber(searchParams.get("tail"), 200);
  const job = await requireJob(jobId);
  const logEntry = (job.logs ?? []).find((entry) => !requestedKind || entry.kind === requestedKind);
  if (!logEntry?.path) {
    throw new Error(`No log entry was found for job '${jobId}'.`);
  }

  const logPath = ensureProjectPath(logEntry.path);
  const logStat = await safeStat(logPath);
  if (!logStat?.isFile()) {
    throw new Error(`Log file '${logPath}' was not found.`);
  }

  const lines = await readTextTail(logPath, tailLines);
  return {
    jobId,
    kind: logEntry.kind ?? "log",
    path: logPath,
    sizeBytes: logStat.size,
    tailLineCount: lines.length,
    lines,
  };
}

export async function getJobReportPayload(searchParams) {
  const jobId = searchParams.get("job");
  if (!jobId) {
    throw new Error("Missing required 'job' query parameter.");
  }

  const job = await requireJob(jobId);
  const reportPath = ensureProjectPath(job.result?.reportPath);
  if (!reportPath) {
    throw new Error(`Job '${jobId}' does not have a report path.`);
  }

  const report = await readJson(reportPath, null);
  if (!report) {
    throw new Error(`Report '${reportPath}' could not be read.`);
  }

  return {
    jobId,
    reportPath,
    report,
  };
}

export async function getJobArtifactsPayload(searchParams) {
  const jobId = searchParams.get("job");
  if (!jobId) {
    throw new Error("Missing required 'job' query parameter.");
  }

  const job = await requireJob(jobId);
  const artifacts = [];
  for (const entry of job.artifacts ?? []) {
    const artifactPath = ensureProjectPath(entry.path);
    const fileStat = artifactPath ? await safeStat(artifactPath) : null;
    artifacts.push({
      kind: entry.kind ?? "artifact",
      path: artifactPath,
      exists: Boolean(fileStat),
      sizeBytes: fileStat?.size ?? null,
      extension: artifactPath ? path.extname(artifactPath) : null,
    });
  }

  return {
    jobId,
    artifactCount: artifacts.length,
    artifacts,
  };
}
