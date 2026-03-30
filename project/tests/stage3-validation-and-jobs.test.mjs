import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJobArtifactsPayload, getJobLogPayload, getJobReportPayload, getJobsPayload } from "../scripts/stage3-job-service-data.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const jobsPath = path.join(projectRoot, "job-manager", "data", "jobs.json");
const logsRoot = path.join(projectRoot, "job-manager", "logs");
const reportsRoot = path.join(projectRoot, "job-manager", "reports");

function params(entries) {
  return new URLSearchParams(entries);
}

function parseI2cScanLines(lines) {
  const scans = new Map();
  for (const line of lines) {
    const match = String(line).trim().match(/^BoardManagerI2CScan:\s+bus=(\S+)\s+observed=(.+)$/);
    if (!match) continue;
    scans.set(match[1], match[2] === "none" ? [] : match[2].split(",").map((entry) => entry.trim().toLowerCase()));
  }
  return scans;
}

function buildValidationCheck(configuredAddresses, observedAddresses) {
  const configured = [...configuredAddresses].sort();
  const observed = [...observedAddresses].sort();
  return {
    pass: configured.every((entry) => observed.includes(entry)) && observed.every((entry) => configured.includes(entry)),
    missingConfigured: configured.filter((entry) => !observed.includes(entry)),
    unexpectedObserved: observed.filter((entry) => !configured.includes(entry)),
  };
}

export async function runStage3Tests() {
  const lines = [
    "BoardManagerFirmware: app=dial_demo version=0.1.0 build=build-123 board=m5stack_dial_v1_1",
    "BoardManagerAgent: board=m5stack_dial_v1_1 app=dial_demo version=0.1.0 capabilities=display,rfid,touch build=build-123",
    "BoardManagerI2CScan: bus=internal_i2c observed=0x28,0x38,0x51,0x68",
    "BoardManagerHealth: kind=voltage name=vbat value=3.71 unit=V"
  ];
  const scans = parseI2cScanLines(lines);
  assert.deepEqual(scans.get("internal_i2c"), ["0x28", "0x38", "0x51", "0x68"]);

  const validation = buildValidationCheck(["0x28", "0x38", "0x51"], scans.get("internal_i2c"));
  assert.equal(validation.pass, false);
  assert.deepEqual(validation.missingConfigured, []);
  assert.deepEqual(validation.unexpectedObserved, ["0x68"]);

  const originalJobs = await readFile(jobsPath, "utf8");
  const logPath = path.join(logsRoot, "stage3-test.log");
  const reportPath = path.join(reportsRoot, "stage3-test-report.json");

  try {
    const now = "2026-03-30T17:45:00.000Z";
    await writeFile(logPath, "line-1\nline-2\nline-3\n", "utf8");
    await writeFile(reportPath, `${JSON.stringify({
      reportKind: "debug",
      generatedAt: now,
      reportPath,
      result: { summary: "ok", exitCode: 0, pass: true }
    }, null, 2)}\n`, "utf8");

    const store = {
      generatedAt: now,
      nextJobSequence: 2,
      jobs: [
        {
          jobId: "job-000001",
          action: "build",
          status: "succeeded",
          createdAt: now,
          updatedAt: now,
          startedAt: now,
          completedAt: now,
          request: {
            boardId: "m5stack_dial_v1_1",
            unitId: null,
            target: null,
            firmwareTarget: null,
            appId: "m5stack_dial_demo",
            platform: "esp32",
            transport: null,
            reason: "stage3-test"
          },
          resolution: {
            matchedBoardId: "m5stack_dial_v1_1",
            matchedUnitId: null,
            matchedFamilyKey: "board:m5stack_dial_v1_1",
            matchedProfileId: null,
            resolvedTransportKind: null,
            resolvedTransportPort: null,
            source: "build-project-only",
            present: false,
            boardCandidates: ["m5stack_dial_v1_1"],
            matchedProjectId: "m5stack_dial_demo",
            resolvedAppId: "m5stack_dial_demo",
            resolvedAppRoot: "apps/m5stack_dial_demo",
            resolvedUserCodeRoot: "apps/m5stack_dial_demo/main",
            resolvedStableApi: "firmware-common/board_user_api.h",
            resolvedFirmwareFamily: "esp-idf",
            resolvedEntryPoint: "main/app_main.c",
            otaPolicy: null,
            candidateProjectIds: ["m5stack_dial_demo"]
          },
          logs: [{ kind: "build-log", path: logPath }],
          artifacts: [{ kind: "firmware-elf", path: path.join(projectRoot, "build", "esp32-m5stack_dial_demo", "m5stack_dial_demo.elf") }],
          result: { summary: "stage3 success", reportPath, exitCode: 0, pass: true }
        }
      ]
    };
    await writeFile(jobsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

    const jobsPayload = await getJobsPayload(params([["job", "job-000001"]]));
    assert.equal(jobsPayload.jobCount, 1);
    assert.equal(jobsPayload.jobs[0].status, "succeeded");
    assert.equal(jobsPayload.jobs[0].result.pass, true);

    const logPayload = await getJobLogPayload(params([["job", "job-000001"], ["tail", "2"]]));
    assert.equal(logPayload.tailLineCount, 2);
    assert.deepEqual(logPayload.lines, ["line-2", "line-3"]);

    const reportPayload = await getJobReportPayload(params([["job", "job-000001"]]));
    assert.equal(reportPayload.report.reportKind, "debug");

    const artifactsPayload = await getJobArtifactsPayload(params([["job", "job-000001"]]));
    assert.equal(artifactsPayload.artifactCount, 1);
    assert.equal(artifactsPayload.artifacts[0].kind, "firmware-elf");
    assert.equal(artifactsPayload.artifacts[0].exists, true);
  } finally {
    await writeFile(jobsPath, originalJobs, "utf8");
    await rm(logPath, { force: true });
    await rm(reportPath, { force: true });
  }
}
