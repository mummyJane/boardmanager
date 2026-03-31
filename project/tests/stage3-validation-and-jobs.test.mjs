import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseI2cScanLines, parseTelemetry, inferCheckResult, buildReport } from "../scripts/run-stage3-validation.mjs";
import { getJobArtifactsPayload, getJobLogPayload, getJobReportPayload, getJobsPayload } from "../scripts/stage3-job-service-data.mjs";

function params(entries) {
  return new URLSearchParams(entries);
}

export async function runStage3Tests() {
  const contract = {
    boardId: "m5stack_dial_v1_1",
    displayName: "M5Stack Dial V1.1",
    platformSdk: "esp-idf",
    phases: [
      {
        phaseId: "bus:internal_i2c",
        order: 1,
        level: "bus",
        target: "internal_i2c",
        checks: [
          {
            checkId: "internal_i2c_scan",
            kind: "i2c-scan",
            source: "BoardManagerI2CScan",
            config: {
              bus: "internal_i2c",
              configuredAddresses: ["0x28", "0x38", "0x51"],
            },
          },
        ],
      },
    ],
  };

  const unit = {
    unitId: "mac:fixture:1",
    identity: { stableKey: "mac:fixture:1", mac: "aa:bb:cc:dd:ee:ff", serialNumber: "fixture-serial" },
    match: { boardId: "m5stack_dial_v1_1" },
    transport: { kind: "serial", port: "COM99" },
    observed: { chip: "ESP32-S3", firmwareApp: "dial_demo", firmwareVersion: "0.1.0", firmwareBuildId: "build-123", firmwareBoard: "m5stack_dial_v1_1" },
  };

  const lines = [
    "BoardManagerFirmware: app=dial_demo version=0.1.0 build=build-123 board=m5stack_dial_v1_1",
    "BoardManagerAgent: board=m5stack_dial_v1_1 app=dial_demo version=0.1.0 capabilities=display,rfid,touch build=build-123",
    "BoardManagerI2CScan: bus=internal_i2c observed=0x28,0x38,0x51,0x68",
    "BoardManagerHealth: kind=voltage name=vbat value=3.71 unit=V",
  ];

  const scanMap = parseI2cScanLines(lines);
  assert.deepEqual(scanMap.get("internal_i2c").observedAddresses, ["0x28", "0x38", "0x51", "0x68"]);

  const telemetry = parseTelemetry(lines, contract);
  const inferred = inferCheckResult(contract, contract.phases[0].checks[0], unit, telemetry, scanMap);
  assert.equal(inferred.pass, false);
  assert.deepEqual(inferred.evidence.missingConfigured, []);
  assert.deepEqual(inferred.evidence.unexpectedObserved, ["0x68"]);

  const report = buildReport(contract, unit, "COM99", scanMap, lines, telemetry);
  assert.equal(report.summary.overallPass, false);
  assert.equal(report.summary.failingCheckCount, 1);
  assert.equal(report.identity.stableUnitId, "mac:fixture:1");
  assert.equal(report.health.voltages[0].name, "vbat");

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "boardmanager-stage3-tests-"));
  const jobStorePath = path.join(tempRoot, "job-manager", "data", "jobs.json");
  const logsRoot = path.join(tempRoot, "job-manager", "logs");
  const reportsRoot = path.join(tempRoot, "job-manager", "reports");
  const buildRoot = path.join(tempRoot, "build", "fixture-app");

  try {
    await mkdir(path.dirname(jobStorePath), { recursive: true });
    await mkdir(logsRoot, { recursive: true });
    await mkdir(reportsRoot, { recursive: true });
    await mkdir(buildRoot, { recursive: true });

    const logPath = path.join(logsRoot, "stage3-test.log");
    const reportPath = path.join(reportsRoot, "stage3-test-report.json");
    const artifactPath = path.join(buildRoot, "fixture.elf");
    await writeFile(logPath, "line-1\nline-2\nline-3\n", "utf8");
    await writeFile(reportPath, `${JSON.stringify({ reportKind: "debug", generatedAt: "2026-03-30T17:45:00.000Z", result: { summary: "ok", exitCode: 0, pass: true } }, null, 2)}\n`, "utf8");
    await writeFile(artifactPath, "elf", "utf8");

    await writeFile(jobStorePath, `${JSON.stringify({
      generatedAt: "2026-03-30T17:45:00.000Z",
      nextJobSequence: 2,
      jobs: [
        {
          jobId: "job-000001",
          action: "build",
          status: "succeeded",
          createdAt: "2026-03-30T17:45:00.000Z",
          updatedAt: "2026-03-30T17:45:00.000Z",
          resolution: {
            matchedBoardId: "m5stack_dial_v1_1",
            matchedProjectId: "m5stack_dial_demo",
            matchedUnitId: null,
            resolvedTransportPort: null,
          },
          logs: [{ kind: "build-log", path: logPath }],
          artifacts: [{ kind: "firmware-elf", path: artifactPath }],
          result: { summary: "stage3 success", reportPath, exitCode: 0, pass: true },
        },
      ],
    }, null, 2)}\n`, "utf8");

    const options = { projectRoot: tempRoot, jobStorePath };
    const jobsPayload = await getJobsPayload(params([["job", "job-000001"]]), options);
    assert.equal(jobsPayload.jobCount, 1);
    assert.equal(jobsPayload.jobs[0].status, "succeeded");

    const logPayload = await getJobLogPayload(params([["job", "job-000001"], ["tail", "2"]]), options);
    assert.equal(logPayload.tailLineCount, 2);
    assert.deepEqual(logPayload.lines, ["line-2", "line-3"]);

    const reportPayload = await getJobReportPayload(params([["job", "job-000001"]]), options);
    assert.equal(reportPayload.report.reportKind, "debug");

    const artifactsPayload = await getJobArtifactsPayload(params([["job", "job-000001"]]), options);
    assert.equal(artifactsPayload.artifactCount, 1);
    assert.equal(artifactsPayload.artifacts[0].exists, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
