import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBoardCatalog, deriveBoardCandidates, buildExactBoard } from "../scripts/discovery-board-catalog.mjs";
import {
  buildIdentityIndex,
  detectIdentityConflict,
  deriveFamilyFingerprint,
  markMissingUnits,
  refreshFamilyTransitions,
} from "../scripts/discover-units.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export async function runDiscoveryTests() {
  const boardCatalog = await loadBoardCatalog(projectRoot);
  const fingerprint = {
    vid: "303A",
    pid: "1001",
    chipFamily: "esp32-s3",
    description: "USB Serial Device",
    name: "USB Serial Device (COM3)",
    firmwareSignature: "board_manager_dial_smoketest",
    capabilities: ["display", "rfid", "touch", "wifi"],
  };

  const candidates = deriveBoardCandidates(fingerprint, [], boardCatalog);
  assert.ok(candidates.length > 0, "expected candidate boards for Dial-like fingerprint");
  assert.equal(candidates[0].boardId, "m5stack_dial_v1_1");
  assert.match(candidates[0].reasons.join(" "), /Dial|Capabilities overlap|Chip family/i);
  assert.equal(buildExactBoard("m5stack_dial_v1_1", boardCatalog)?.boardId, "m5stack_dial_v1_1");

  const units = [
    {
      stableKey: "mac:aa:aa:aa:aa:aa:aa",
      identity: {
        stableKey: "mac:aa:aa:aa:aa:aa:aa",
        mac: "aa:aa:aa:aa:aa:aa",
        usbInstance: "USB\\VID_1234&PID_0001\\A",
        serialNumber: "A",
        aliases: [],
        priorStableKeys: [],
      },
    },
    {
      stableKey: "usb:USB\\VID_1234&PID_0001\\B",
      identity: {
        stableKey: "usb:USB\\VID_1234&PID_0001\\B",
        mac: null,
        usbInstance: "USB\\VID_1234&PID_0001\\B",
        serialNumber: "B",
        aliases: [],
        priorStableKeys: [],
      },
    },
  ];
  const indices = buildIdentityIndex(units);
  const conflict = detectIdentityConflict(
    {
      mac: "aa:aa:aa:aa:aa:aa",
      usbInstance: "USB\\VID_1234&PID_0001\\B",
      serialNumber: "B",
      vid: "1234",
      pid: "0001",
    },
    {
      port: "COM9",
      usbInstance: "USB\\VID_1234&PID_0001\\B",
    },
    indices,
  );
  assert.ok(conflict, "expected identity conflict");
  assert.equal(conflict.chosenStableKey, "mac:aa:aa:aa:aa:aa:aa");
  assert.deepEqual(conflict.candidateStableKeys, ["mac:aa:aa:aa:aa:aa:aa", "usb:USB\\VID_1234&PID_0001\\B"]);
  assert.match(conflict.summary, /COM9/);

  const matched = deriveFamilyFingerprint({
    transport: { description: "USB Serial Device", name: "USB Serial Device (COM3)" },
    observed: {
      vid: "303A",
      pid: "1001",
      chip: "ESP32-S3 (QFN56) (revision v0.2)",
      firmwareSignature: "board_manager_dial_smoketest",
      agentCapabilities: ["display", "wifi"],
      usbDescriptor: { manufacturer: "Microsoft", service: "usbser" },
    },
    match: { boardId: "m5stack_dial_v1_1" },
  });
  assert.equal(matched.familyKey, "board:m5stack_dial_v1_1");
  assert.equal(matched.profileId, "board_m5stack_dial_v1_1");
  assert.equal(matched.status, "known-board");

  const unknown = deriveFamilyFingerprint({
    transport: { description: "Silicon Labs CP210x USB to UART Bridge", name: "Silicon Labs CP210x USB to UART Bridge (COM7)" },
    observed: {
      vid: "10C4",
      pid: "EA60",
      chip: "ESP32-D0WD-V3 (revision v3.1)",
      firmwareSignature: null,
      agentCapabilities: [],
      usbDescriptor: { manufacturer: "Silicon Labs", service: "silabser" },
    },
    match: { boardId: null },
  });
  assert.match(unknown.familyKey, /^unknown:/);
  assert.equal(unknown.status, "emerging");

  const timestamp = "2026-03-29T21:30:00.000Z";
  const state = {
    units: [
      {
        stableKey: "mac:1",
        familyKey: "board:test_board",
        firstSeenAt: "2026-03-29T20:00:00.000Z",
        lastSeenAt: "2026-03-29T20:10:00.000Z",
        lastPresentAt: "2026-03-29T20:10:00.000Z",
        lastMissingAt: null,
        present: true,
        missingCount: 0,
        transitions: {},
      },
      {
        stableKey: "mac:2",
        familyKey: "board:test_board",
        firstSeenAt: "2026-03-29T20:00:00.000Z",
        lastSeenAt: "2026-03-29T20:10:00.000Z",
        lastPresentAt: "2026-03-29T20:10:00.000Z",
        lastMissingAt: null,
        present: true,
        missingCount: 0,
        transitions: {},
      },
    ],
    families: [
      {
        familyKey: "board:test_board",
        firstSeenAt: "2026-03-29T20:00:00.000Z",
        lastSeenAt: "2026-03-29T20:10:00.000Z",
        lastPresentAt: "2026-03-29T20:10:00.000Z",
        lastMissingAt: null,
        present: true,
        presentUnitCount: 2,
        missingUnitCount: 0,
        seenCount: 2,
        transitions: {},
      },
    ],
  };
  markMissingUnits(state, new Set(["mac:1"]), timestamp);
  refreshFamilyTransitions(state, timestamp, new Set(["mac:1"]));
  const missingUnit = state.units.find((entry) => entry.stableKey === "mac:2");
  const family = state.families[0];
  assert.equal(missingUnit.present, false);
  assert.equal(missingUnit.missingCount, 1);
  assert.equal(missingUnit.lastMissingAt, timestamp);
  assert.equal(family.present, true);
  assert.equal(family.presentUnitCount, 1);
  assert.equal(family.missingUnitCount, 1);
}
