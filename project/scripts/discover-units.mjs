import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadBoardCatalog, deriveBoardCandidates, buildExactBoard } from "./discovery-board-catalog.mjs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "..");
const deviceManagerRoot = path.join(projectRoot, "device-manager");
const inventoryPath = path.join(deviceManagerRoot, "data", "inventory.json");
const unitHistoryPath = path.join(deviceManagerRoot, "data", "unit-history.json");
const annotationsPath = path.join(deviceManagerRoot, "data", "unit-annotations.json");
const profilesRoot = path.join(deviceManagerRoot, "profiles");
const espPython = path.join(projectRoot, "tools", "espressif", "python_env", "idf5.5_py3.13_env", "Scripts", "python.exe");
const esptoolPy = path.join(projectRoot, "toolchains", "esp-idf", "esp-idf", "components", "esptool_py", "esptool", "esptool.py");
const ignoredPorts = new Set(
  String(process.env.BOARD_MANAGER_DISCOVERY_IGNORE_PORTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
);

function parseVidPid(pnpDeviceId) {
  const match = String(pnpDeviceId ?? "").match(/VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i);
  if (!match) {
    return { vid: null, pid: null };
  }
  return { vid: match[1].toUpperCase(), pid: match[2].toUpperCase() };
}

function parseMac(output) {
  const match = output.match(/MAC:\s*([0-9a-f:]{17})/i);
  return match ? match[1].toLowerCase() : null;
}

function parseChip(output) {
  const match = output.match(/Chip is\s+(.+)/i);
  return match ? match[1].trim() : null;
}

function parseSerialFromUsbInstance(pnpDeviceId) {
  const text = String(pnpDeviceId ?? "");
  const parts = text.split("\\");
  return parts.length >= 3 ? parts[2] : null;
}

function parseFirmwareIdentity(rawLine) {
  const text = String(rawLine ?? "");
  const match = text.match(/BoardManagerFirmware:\s+app=(\S+)\s+version=(\S+)\s+build=(.+?)\s+board=(\S+)$/);
  if (!match) {
    return {
      firmwareApp: null,
      firmwareVersion: null,
      firmwareBuildId: null,
      firmwareBoard: null,
    };
  }

  return {
    firmwareApp: match[1],
    firmwareVersion: match[2],
    firmwareBuildId: match[3],
    firmwareBoard: match[4],
  };
}

function pickSignatureLine(lines) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("BoardManagerFirmware:")) return trimmed;
    if (trimmed.includes("Board Manager dial smoke test starting")) return trimmed;
    if (trimmed.includes("Board Manager CoreS3 GNSS bring-up starting")) return trimmed;
    if (trimmed.includes("Board Manager")) return trimmed;
    if (trimmed.includes("Live inputs:")) return trimmed;
    if (trimmed.includes("Live GNSS PPS state:")) return trimmed;
    if (trimmed.includes("stamp_ring_factory_test")) return trimmed;
  }
  return lines.map((line) => line.trim()).find(Boolean) ?? null;
}

function simplifyChip(chip) {
  const text = String(chip ?? "").toLowerCase();
  if (text.includes("esp32-s3")) return "esp32-s3";
  if (text.includes("esp32")) return "esp32";
  if (text.includes("stm32f0")) return "stm32f0";
  if (text.includes("stm32f4")) return "stm32f4";
  return chip ?? null;
}

function sanitizeSegment(text) {
  return String(text ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "unknown";
}

function uniqueSorted(values) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort();
}

function normalizeAnnotation(entry) {
  if (!entry) {
    return {
      label: null,
      notes: [],
      owner: null,
      location: null,
      purpose: null,
      updatedAt: null,
    };
  }

  return {
    label: entry.label ?? null,
    notes: Array.isArray(entry.notes) ? entry.notes.filter(Boolean) : [],
    owner: entry.owner ?? null,
    location: entry.location ?? null,
    purpose: entry.purpose ?? null,
    updatedAt: entry.updatedAt ?? null,
  };
}

function normalizeMetadataHistory(entry) {
  return {
    owners: uniqueSorted(entry?.owners ?? []),
    locations: uniqueSorted(entry?.locations ?? []),
    purposes: uniqueSorted(entry?.purposes ?? []),
    firstUpdatedAt: entry?.firstUpdatedAt ?? null,
    lastUpdatedAt: entry?.lastUpdatedAt ?? null,
    entries: Array.isArray(entry?.entries) ? entry.entries.filter(Boolean) : [],
  };
}

function mergeMetadataHistory(existing, annotation, timestamp) {
  const history = normalizeMetadataHistory(existing);
  const hasValues = Boolean(annotation?.owner || annotation?.location || annotation?.purpose);
  const entry = hasValues
    ? {
        updatedAt: annotation.updatedAt ?? timestamp,
        owner: annotation.owner ?? null,
        location: annotation.location ?? null,
        purpose: annotation.purpose ?? null,
      }
    : null;

  const lastEntry = history.entries[history.entries.length - 1] ?? null;
  const sameAsLast = entry
    && lastEntry
    && lastEntry.owner === entry.owner
    && lastEntry.location === entry.location
    && lastEntry.purpose === entry.purpose;

  return {
    owners: uniqueSorted([...(history.owners ?? []), annotation?.owner]),
    locations: uniqueSorted([...(history.locations ?? []), annotation?.location]),
    purposes: uniqueSorted([...(history.purposes ?? []), annotation?.purpose]),
    firstUpdatedAt: history.firstUpdatedAt ?? (entry?.updatedAt ?? null),
    lastUpdatedAt: entry?.updatedAt ?? history.lastUpdatedAt ?? null,
    entries: entry && !sameAsLast ? [...history.entries, entry] : history.entries,
  };
}

async function readPorts() {
  const command = "Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Description,PNPDeviceID | ConvertTo-Json -Depth 3";
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", command], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  const parsed = JSON.parse(stdout || "[]");
  const ports = Array.isArray(parsed) ? parsed : [parsed];
  return ports.filter((port) => !ignoredPorts.has(String(port?.DeviceID ?? "").trim()));
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function buildIdentityIndex(units) {
  const byStableKey = new Map();
  const byMac = new Map();
  const byUsbInstance = new Map();
  const bySerial = new Map();

  for (const unit of units) {
    const identity = unit.identity ?? unit;
    const stableKey = unit.stableKey ?? identity.stableKey;
    if (stableKey) byStableKey.set(stableKey, unit);
    if (identity.mac) byMac.set(identity.mac, unit);
    if (identity.usbInstance) byUsbInstance.set(identity.usbInstance, unit);
    if (identity.serialNumber) bySerial.set(identity.serialNumber, unit);
  }

  return { byStableKey, byMac, byUsbInstance, bySerial };
}

function buildAnnotationIndex(units) {
  const byStableKey = new Map();
  for (const unit of units ?? []) {
    if (unit?.stableKey) byStableKey.set(unit.stableKey, unit);
  }
  return { byStableKey };
}

function buildFamilyIndex(families) {
  const byFamilyKey = new Map();
  const byFingerprintKey = new Map();
  for (const family of families) {
    byFamilyKey.set(family.familyKey, family);
    const fingerprintKey = family.fingerprint?.fingerprintKey;
    if (fingerprintKey) byFingerprintKey.set(fingerprintKey, family);
  }
  return { byFamilyKey, byFingerprintKey };
}

async function runEspTool(port) {
  try {
    const { stdout, stderr } = await execFileAsync(espPython, [esptoolPy, "--chip", "esp32s3", "-p", port, "read_mac"], {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return `${stdout}\n${stderr}`;
  } catch (error) {
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    return `${stdout}\n${stderr}`;
  }
}

async function captureSignature(port) {
  const pythonSnippet = [
    "import serial,time,sys",
    `ser=serial.Serial('${port}',115200,timeout=0.2)`,
    "ser.rts=True",
    "time.sleep(0.2)",
    "ser.rts=False",
    "end=time.time()+4",
    "chunks=[]",
    "while time.time()<end:",
    " data=ser.read(4096)",
    " if data: chunks.append(data)",
    " time.sleep(0.05)",
    "ser.close()",
    "sys.stdout.buffer.write(b''.join(chunks))"
  ].join("\n");

  try {
    const { stdout } = await execFileAsync(espPython, ["-c", pythonSnippet], {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const lines = String(stdout).split(/\r?\n/).filter(Boolean);
    const rawSignatureLine = pickSignatureLine(lines);
    const firmwareLine = lines.map((line) => line.trim()).find((line) => line.includes("BoardManagerFirmware:")) ?? null;
    const identity = parseFirmwareIdentity(firmwareLine);
    let firmwareSignature = null;
    if (identity.firmwareApp === "m5stack_dial_demo") firmwareSignature = "board_manager_dial_smoketest";
    else if (identity.firmwareApp === "m5stack_cores3_gnss_demo") firmwareSignature = "board_manager_cores3_gnss_demo";
    else if (rawSignatureLine) {
      if (rawSignatureLine.includes("Board Manager dial smoke test starting")) firmwareSignature = "board_manager_dial_smoketest";
      else if (rawSignatureLine.includes("Board Manager CoreS3 GNSS bring-up starting")) firmwareSignature = "board_manager_cores3_gnss_demo";
      else if (rawSignatureLine.includes("Live GNSS PPS state:")) firmwareSignature = "board_manager_cores3_gnss_demo";
      else if (rawSignatureLine.includes("Live inputs:")) firmwareSignature = "board_manager_dial_smoketest";
      else if (rawSignatureLine.includes("stamp_ring_factory_test")) firmwareSignature = "m5_factory_stamp_ring_test";
      else if (rawSignatureLine.includes("Board Manager")) firmwareSignature = "board_manager_boot_banner";
    }
    return {
      firmwareSignature,
      rawSignatureLine,
      firmwareLine,
      firmwareApp: identity.firmwareApp,
      firmwareVersion: identity.firmwareVersion,
      firmwareBuildId: identity.firmwareBuildId,
      firmwareBoard: identity.firmwareBoard,
    };
  } catch {
    return {
      firmwareSignature: null,
      rawSignatureLine: null,
      firmwareLine: null,
      firmwareApp: null,
      firmwareVersion: null,
      firmwareBuildId: null,
      firmwareBoard: null,
    };
  }
}

function deriveStableKey(observed, transport, previousMatch) {
  if (observed.mac) return `mac:${observed.mac}`;
  if (previousMatch?.identity?.stableKey) return previousMatch.identity.stableKey;
  if (transport.usbInstance) return `usb:${transport.usbInstance}`;
  if (observed.serialNumber) return `serial:${observed.serialNumber}`;
  return `port:${transport.port}`;
}

function mergeIdentity(observed, transport, previousMatch) {
  const prior = previousMatch?.identity ?? previousMatch ?? {};
  const aliases = new Set(Array.isArray(prior.aliases) ? prior.aliases : []);
  if (transport.port) aliases.add(transport.port);
  if (transport.name) aliases.add(transport.name);

  return {
    stableKey: deriveStableKey(observed, transport, previousMatch),
    usbInstance: observed.usbInstance ?? prior.usbInstance ?? transport.usbInstance ?? null,
    mac: observed.mac ?? prior.mac ?? null,
    serialNumber: observed.serialNumber ?? prior.serialNumber ?? null,
    aliases: Array.from(aliases).sort(),
  };
}

function findPreviousUnit(observed, transport, indices) {
  if (observed.mac && indices.byMac.has(observed.mac)) return indices.byMac.get(observed.mac);
  if (transport.usbInstance && indices.byUsbInstance.has(transport.usbInstance)) return indices.byUsbInstance.get(transport.usbInstance);
  if (observed.serialNumber && indices.bySerial.has(observed.serialNumber)) return indices.bySerial.get(observed.serialNumber);
  return null;
}

function basicHeuristicMatch(unit) {
  const { description, name } = unit.transport;
  const { mac, firmwareSignature, rawSignatureLine, firmwareBoard } = unit.observed;

  if (firmwareBoard === "m5stack_dial_v1_1") {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Firmware self-identifies the board as m5stack_dial_v1_1",
      source: "firmware-self-id"
    };
  }

  if (firmwareBoard === "m5stack_cores3_gnss_v1") {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Firmware self-identifies the board as m5stack_cores3_gnss_v1",
      source: "firmware-self-id"
    };
  }

  if ((description ?? "").includes("STLink") || (name ?? "").includes("STLink")) {
    return {
      status: "matched",
      boardId: "p_nucleo_usb001_f072rb_v1",
      reason: "STLink virtual COM port matches the attached P-NUCLEO-USB001 / Nucleo-F072RB",
      source: "heuristic"
    };
  }

  if (firmwareSignature === "board_manager_cores3_gnss_demo") {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Current firmware signature matches the CoreS3 GNSS demo",
      source: "heuristic"
    };
  }

  if (firmwareSignature === "board_manager_dial_smoketest" || firmwareSignature === "m5_factory_stamp_ring_test") {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Current firmware signature matches a Dial smoke test or factory test image",
      source: "heuristic"
    };
  }

  if ((rawSignatureLine ?? "").includes("dial smoke test")) {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Boot banner identifies the board as the Dial smoke test image",
      source: "heuristic"
    };
  }

  if ((rawSignatureLine ?? "").includes("CoreS3 GNSS")) {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Boot banner identifies the board as the CoreS3 GNSS bring-up image",
      source: "heuristic"
    };
  }

  if (mac === "48:27:e2:66:b0:04") {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Observed MAC matches the previously fingerprinted CoreS3 GNSS bench unit",
      source: "heuristic"
    };
  }

  if (mac === "c0:4e:30:12:b3:e0") {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Observed MAC matches the previously fingerprinted second Dial unit",
      source: "heuristic"
    };
  }

  return {
    status: "unmatched",
    boardId: null,
    reason: "No current heuristic matched this unit to a known board definition",
    source: null
  };
}

function deriveFamilyFingerprint(unit) {
  const nameText = `${unit.transport.description ?? ""} ${unit.transport.name ?? ""}`.toLowerCase();
  const chipFamily = simplifyChip(unit.observed.chip);

  if (unit.match.boardId) {
    return {
      familyKey: `board:${unit.match.boardId}`,
      profileId: `board_${sanitizeSegment(unit.match.boardId)}`,
      status: "known-board",
      fingerprintKey: `board:${unit.match.boardId}`,
      vid: unit.observed.vid,
      pid: unit.observed.pid,
      chipFamily,
      chip: unit.observed.chip,
      description: unit.transport.description ?? null,
      name: unit.transport.name ?? null,
      firmwareSignature: unit.observed.firmwareSignature ?? null,
    };
  }

  if (nameText.includes("stlink")) {
    return {
      familyKey: `transport:stlink:${unit.observed.vid ?? "unknown"}:${unit.observed.pid ?? "unknown"}`,
      profileId: `transport_stlink_${sanitizeSegment(unit.observed.vid)}_${sanitizeSegment(unit.observed.pid)}`,
      status: "known-transport-family",
      fingerprintKey: `transport:stlink:${unit.observed.vid ?? "unknown"}:${unit.observed.pid ?? "unknown"}`,
      vid: unit.observed.vid,
      pid: unit.observed.pid,
      chipFamily,
      chip: unit.observed.chip,
      description: unit.transport.description ?? null,
      name: unit.transport.name ?? null,
      firmwareSignature: unit.observed.firmwareSignature ?? null,
    };
  }

  const fingerprintParts = [
    `vidpid:${unit.observed.vid ?? "unknown"}:${unit.observed.pid ?? "unknown"}`,
    `chip:${sanitizeSegment(chipFamily ?? unit.observed.chip ?? "unknown")}`,
    `desc:${sanitizeSegment(unit.transport.description ?? unit.transport.name ?? "unknown")}`,
  ];

  return {
    familyKey: `unknown:${fingerprintParts.join("|")}`,
    profileId: `unknown_${sanitizeSegment(unit.observed.vid)}_${sanitizeSegment(unit.observed.pid)}_${sanitizeSegment(chipFamily ?? unit.observed.chip ?? unit.transport.description ?? "unit")}`,
    status: "emerging",
    fingerprintKey: fingerprintParts.join("|"),
    vid: unit.observed.vid,
    pid: unit.observed.pid,
    chipFamily,
    chip: unit.observed.chip,
    description: unit.transport.description ?? null,
    name: unit.transport.name ?? null,
    firmwareSignature: unit.observed.firmwareSignature ?? null,
  };
}

function resolveMatch(unit, previousUnit, existingFamily) {
  if (unit.match.status === "matched") {
    return unit.match;
  }

  if (previousUnit?.boardIds?.length) {
    return {
      status: "matched",
      boardId: previousUnit.boardIds[previousUnit.boardIds.length - 1],
      reason: "Stable unit identity matches a previously seen unit with a recorded board type",
      source: "history-unit"
    };
  }

  if (existingFamily?.boardIds?.length === 1) {
    return {
      status: "matched",
      boardId: existingFamily.boardIds[0],
      reason: "New physical unit matches a previously seen board family",
      source: "history-family"
    };
  }

  return unit.match;
}

function buildHistoryStatus(previousUnit, existingFamily) {
  if (previousUnit) {
    return {
      status: "known-unit",
      reason: "Stable identity matches a previously seen physical unit"
    };
  }

  if (existingFamily) {
    return {
      status: "known-family",
      reason: "This physical unit is new, but its board family was seen before"
    };
  }

  return {
    status: "new-family",
    reason: "Neither this physical unit nor its card family has been seen before"
  };
}

function attachAnnotation(unit, annotationIndex) {
  const entry = annotationIndex.byStableKey.get(unit.identity.stableKey);
  unit.annotation = normalizeAnnotation(entry);
}

async function observePort(portInfo, unitIndex, familyIndex, annotationIndex) {
  const transport = {
    kind: "serial",
    port: portInfo.DeviceID,
    usbInstance: portInfo.PNPDeviceID ?? null,
    description: portInfo.Description ?? null,
    name: portInfo.Name ?? null,
  };

  const vidPid = parseVidPid(portInfo.PNPDeviceID);
  const observed = {
    vid: vidPid.vid,
    pid: vidPid.pid,
    chip: null,
    mac: null,
    serialNumber: parseSerialFromUsbInstance(portInfo.PNPDeviceID),
    usbInstance: portInfo.PNPDeviceID ?? null,
    firmwareSignature: null,
    rawSignatureLine: null,
    firmwareLine: null,
    firmwareApp: null,
    firmwareVersion: null,
    firmwareBuildId: null,
    firmwareBoard: null,
  };

  if ((vidPid.vid === "303A" && vidPid.pid === "1001") || (transport.name ?? "").includes("USB Serial Device")) {
    const toolOutput = await runEspTool(transport.port);
    observed.mac = parseMac(toolOutput) ?? observed.mac;
    observed.chip = parseChip(toolOutput);
    const signature = await captureSignature(transport.port);
    observed.firmwareSignature = signature.firmwareSignature;
    observed.rawSignatureLine = signature.rawSignatureLine;
    observed.firmwareLine = signature.firmwareLine;
    observed.firmwareApp = signature.firmwareApp;
    observed.firmwareVersion = signature.firmwareVersion;
    observed.firmwareBuildId = signature.firmwareBuildId;
    observed.firmwareBoard = signature.firmwareBoard;
  }

  const previousUnit = findPreviousUnit(observed, transport, unitIndex);
  const identity = mergeIdentity(observed, transport, previousUnit);

  const unit = {
    unitId: identity.stableKey,
    identity,
    transport,
    observed: {
      vid: observed.vid,
      pid: observed.pid,
      chip: observed.chip,
      mac: observed.mac,
      serialNumber: observed.serialNumber,
      firmwareSignature: observed.firmwareSignature,
      rawSignatureLine: observed.rawSignatureLine,
      firmwareLine: observed.firmwareLine,
      firmwareApp: observed.firmwareApp,
      firmwareVersion: observed.firmwareVersion,
      firmwareBuildId: observed.firmwareBuildId,
      firmwareBoard: observed.firmwareBoard,
    },
    annotation: normalizeAnnotation(null),
    match: { status: "unknown", boardId: null, reason: null, source: null },
    history: { status: "unknown", familyKey: "unknown", profileId: null, firstSeenAt: null, lastSeenAt: null, seenCount: null, reason: null }
  };

  attachAnnotation(unit, annotationIndex);
  unit.match = basicHeuristicMatch(unit);
  const familyFingerprint = deriveFamilyFingerprint(unit);
  const existingFamily = familyIndex.byFamilyKey.get(familyFingerprint.familyKey) ?? familyIndex.byFingerprintKey.get(familyFingerprint.fingerprintKey) ?? null;
  unit.match = resolveMatch(unit, previousUnit, existingFamily);

  const resolvedFamilyFingerprint = unit.match.boardId
    ? deriveFamilyFingerprint({ ...unit, match: { ...unit.match } })
    : familyFingerprint;
  const resolvedFamily = familyIndex.byFamilyKey.get(resolvedFamilyFingerprint.familyKey) ?? familyIndex.byFingerprintKey.get(resolvedFamilyFingerprint.fingerprintKey) ?? null;
  const historyStatus = buildHistoryStatus(previousUnit, resolvedFamily);

  unit.history = {
    status: historyStatus.status,
    familyKey: resolvedFamilyFingerprint.familyKey,
    profileId: resolvedFamilyFingerprint.profileId,
    firstSeenAt: previousUnit?.firstSeenAt ?? resolvedFamily?.firstSeenAt ?? null,
    lastSeenAt: previousUnit?.lastSeenAt ?? resolvedFamily?.lastSeenAt ?? null,
    seenCount: previousUnit?.seenCount ?? null,
    reason: historyStatus.reason,
  };

  return { unit, familyFingerprint: resolvedFamilyFingerprint };
}

function mergeObservedHistory(existing, unit) {
  return {
    vid: unit.observed.vid ?? existing?.vid ?? null,
    pid: unit.observed.pid ?? existing?.pid ?? null,
    chips: uniqueSorted([...(existing?.chips ?? []), unit.observed.chip]),
    firmwareSignatures: uniqueSorted([...(existing?.firmwareSignatures ?? []), unit.observed.firmwareSignature]),
    firmwareApps: uniqueSorted([...(existing?.firmwareApps ?? []), unit.observed.firmwareApp]),
    firmwareVersions: uniqueSorted([...(existing?.firmwareVersions ?? []), unit.observed.firmwareVersion]),
    firmwareBuildIds: uniqueSorted([...(existing?.firmwareBuildIds ?? []), unit.observed.firmwareBuildId]),
    firmwareBoards: uniqueSorted([...(existing?.firmwareBoards ?? []), unit.observed.firmwareBoard]),
    firmwareLines: uniqueSorted([...(existing?.firmwareLines ?? []), unit.observed.firmwareLine]),
    rawSignatureLines: uniqueSorted([...(existing?.rawSignatureLines ?? []), unit.observed.rawSignatureLine]),
  };
}

async function ensureProfileFile(familyRecord, timestamp, isNewProfile, boardCatalog) {
  await mkdir(profilesRoot, { recursive: true });
  const profilePath = path.join(profilesRoot, `${familyRecord.profileId}.json`);
  let profile = null;

  try {
    const text = await readFile(profilePath, "utf8");
    profile = JSON.parse(text);
  } catch {
    profile = {
      profileId: familyRecord.profileId,
      familyKey: familyRecord.familyKey,
      status: familyRecord.status === "emerging" ? "draft" : "known-family",
      createdAt: timestamp,
      updatedAt: timestamp,
      boardIds: familyRecord.boardIds,
      sampleUnitIds: familyRecord.sampleUnitIds,
      fingerprint: familyRecord.fingerprint,
      notes: [
        familyRecord.status === "emerging"
          ? "Discovery created this draft profile because a previously unseen board family was observed."
          : "Discovery created this family profile from known board observations."
      ]
    };
  }

  const exactBoard = familyRecord.boardIds.length === 1 ? buildExactBoard(familyRecord.boardIds[0], boardCatalog) : null;
  const candidateBoards = deriveBoardCandidates(familyRecord.fingerprint, familyRecord.boardIds, boardCatalog);

  profile.updatedAt = timestamp;
  profile.boardIds = uniqueSorted([...(profile.boardIds ?? []), ...(familyRecord.boardIds ?? [])]);
  profile.sampleUnitIds = uniqueSorted([...(profile.sampleUnitIds ?? []), ...(familyRecord.sampleUnitIds ?? [])]);
  profile.fingerprint = familyRecord.fingerprint;
  profile.exactBoard = exactBoard;
  profile.candidateBoards = candidateBoards;
  if (isNewProfile && !(profile.notes ?? []).includes("Review this profile and replace generic fingerprint data with a proper board definition match when known.")) {
    profile.notes = [
      ...(profile.notes ?? []),
      "Review this profile and replace generic fingerprint data with a proper board definition match when known."
    ];
  }

  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

async function updateHistory(state, unit, familyFingerprint, timestamp, boardCatalog) {
  const units = Array.isArray(state.units) ? state.units : [];
  const families = Array.isArray(state.families) ? state.families : [];
  const unitIndex = units.findIndex((entry) => entry.stableKey === unit.identity.stableKey);
  const familyIndex = families.findIndex((entry) => entry.familyKey === familyFingerprint.familyKey);

  const existingUnit = unitIndex >= 0 ? units[unitIndex] : null;
  const existingFamily = familyIndex >= 0 ? families[familyIndex] : null;

  const nextUnit = {
    stableKey: unit.identity.stableKey,
    firstSeenAt: existingUnit?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    lastPresentAt: timestamp,
    lastMissingAt: existingUnit?.lastMissingAt ?? null,
    present: true,
    missingCount: existingUnit?.missingCount ?? 0,
    seenCount: (existingUnit?.seenCount ?? 0) + 1,
    familyKey: familyFingerprint.familyKey,
    profileId: familyFingerprint.profileId,
    boardIds: uniqueSorted([...(existingUnit?.boardIds ?? []), unit.match.boardId]),
    identity: unit.identity,
    annotation: unit.annotation,
    metadataHistory: mergeMetadataHistory(existingUnit?.metadataHistory, unit.annotation, timestamp),
    lastTransport: unit.transport,
    observed: mergeObservedHistory(existingUnit?.observed, unit),
  };

  if (unitIndex >= 0) units[unitIndex] = nextUnit;
  else units.push(nextUnit);

  const nextFamily = {
    familyKey: familyFingerprint.familyKey,
    firstSeenAt: existingFamily?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    seenCount: (existingFamily?.seenCount ?? 0) + 1,
    status: familyFingerprint.status,
    profileId: familyFingerprint.profileId,
    boardIds: uniqueSorted([...(existingFamily?.boardIds ?? []), unit.match.boardId]),
    sampleUnitIds: uniqueSorted([...(existingFamily?.sampleUnitIds ?? []), unit.identity.stableKey]).slice(0, 16),
    fingerprint: {
      fingerprintKey: familyFingerprint.fingerprintKey,
      vid: familyFingerprint.vid,
      pid: familyFingerprint.pid,
      chipFamily: familyFingerprint.chipFamily,
      chip: familyFingerprint.chip,
      description: familyFingerprint.description,
      name: familyFingerprint.name,
      firmwareSignature: familyFingerprint.firmwareSignature,
    }
  };

  if (familyIndex >= 0) families[familyIndex] = nextFamily;
  else families.push(nextFamily);

  state.units = units.sort((left, right) => String(left.stableKey).localeCompare(String(right.stableKey)));
  state.families = families.sort((left, right) => String(left.familyKey).localeCompare(String(right.familyKey)));

  await ensureProfileFile(nextFamily, timestamp, !existingFamily, boardCatalog);

  unit.history = {
    status: unit.history.status,
    familyKey: nextFamily.familyKey,
    profileId: nextFamily.profileId,
    firstSeenAt: nextUnit.firstSeenAt,
    lastSeenAt: nextUnit.lastSeenAt,
    seenCount: nextUnit.seenCount,
    reason: unit.history.reason,
  };
}

function markMissingUnits(state, observedStableKeys, timestamp) {
  const units = Array.isArray(state.units) ? state.units : [];
  for (const unit of units) {
    if (observedStableKeys.has(unit.stableKey)) continue;
    const wasPresent = unit.present !== false;
    unit.present = false;
    unit.lastMissingAt = wasPresent ? timestamp : (unit.lastMissingAt ?? timestamp);
    unit.lastPresentAt = unit.lastPresentAt ?? unit.lastSeenAt ?? null;
    unit.missingCount = (unit.missingCount ?? 0) + (wasPresent ? 1 : 0);
  }
}

async function main() {
  const ports = await readPorts();
  const boardCatalog = await loadBoardCatalog(projectRoot);
  const annotationsState = await readJsonOrDefault(annotationsPath, { updatedAt: null, units: [] });
  const annotationIndex = buildAnnotationIndex(annotationsState.units ?? []);
  const historyState = await readJsonOrDefault(unitHistoryPath, {
    generatedAt: null,
    host: { platform: "windows", hostname: null },
    units: [],
    families: [],
  });

  const units = [];
  const observedStableKeys = new Set();
  const timestamp = new Date().toISOString();

  for (const portInfo of ports) {
    const unitIndex = buildIdentityIndex(historyState.units ?? []);
    const familyIndex = buildFamilyIndex(historyState.families ?? []);
    const { unit, familyFingerprint } = await observePort(portInfo, unitIndex, familyIndex, annotationIndex);
    observedStableKeys.add(unit.identity.stableKey);
    await updateHistory(historyState, unit, familyFingerprint, timestamp, boardCatalog);
    units.push(unit);
  }

  markMissingUnits(historyState, observedStableKeys, timestamp);

  units.sort((left, right) => String(left.transport.port).localeCompare(String(right.transport.port)));

  const inventoryPayload = {
    generatedAt: timestamp,
    host: {
      platform: "windows",
      hostname: os.hostname(),
    },
    units,
  };

  historyState.generatedAt = timestamp;
  historyState.host = {
    platform: "windows",
    hostname: os.hostname(),
  };

  await mkdir(path.dirname(inventoryPath), { recursive: true });
  await mkdir(path.dirname(unitHistoryPath), { recursive: true });
  await writeFile(inventoryPath, `${JSON.stringify(inventoryPayload, null, 2)}\n`, "utf8");
  await writeFile(unitHistoryPath, `${JSON.stringify(historyState, null, 2)}\n`, "utf8");

  console.log(`Discovered ${units.length} units.`);
  for (const unit of units) {
    const labelSuffix = unit.annotation.label ? ` label='${unit.annotation.label}'` : "";
    const firmwareSuffix = unit.observed.firmwareVersion ? ` fw=${unit.observed.firmwareApp}@${unit.observed.firmwareVersion}` : "";
    console.log(`${unit.transport.port}: ${unit.match.boardId ?? "unmatched"} [${unit.identity.stableKey}] (${unit.history.status}; ${unit.history.reason})${firmwareSuffix}${labelSuffix}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


