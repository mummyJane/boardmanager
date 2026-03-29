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
const discoveryRunsPath = path.join(deviceManagerRoot, "data", "discovery-runs.json");
const annotationsPath = path.join(deviceManagerRoot, "data", "unit-annotations.json");
const overridesPath = path.join(deviceManagerRoot, "data", "unit-overrides.json");
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

function parseRegistryLabel(value) {
  const text = String(value ?? "").trim();
  const segments = text.split(";").map((entry) => entry.trim()).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return values ? [String(values)] : [];
  }

  return values.map((entry) => String(entry)).filter(Boolean);
}

function parseUsbTopology(locationInformation) {
  const raw = String(locationInformation ?? '').trim();
  if (!raw) {
    return null;
  }

  const hubMatch = raw.match(/^Port_#(\d+)\.Hub_#(\d+)$/i);
  if (hubMatch) {
    const port = Number.parseInt(hubMatch[1], 10);
    const hub = Number.parseInt(hubMatch[2], 10);
    return {
      kind: 'hub-port',
      raw,
      hub,
      port,
      path: `hub-${hub}/port-${port}`,
    };
  }

  if (/^\d{3,4}(?:\.\d{3,4})+$/.test(raw)) {
    const segments = raw.split('.');
    const nonZeroSegments = segments.filter((segment) => segment !== '0000');
    return {
      kind: 'path-segments',
      raw,
      segments,
      nonZeroSegments,
      depth: segments.length,
      path: nonZeroSegments.length > 0 ? nonZeroSegments.join('/') : raw,
    };
  }

  return {
    kind: 'raw',
    raw,
    path: raw,
  };
}

function pickUsbProductName(...values) {
  for (const value of values) {
    const parsed = parseRegistryLabel(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseUsbRevision(hardwareIds) {
  for (const value of normalizeStringList(hardwareIds)) {
    const match = value.match(/REV_([0-9A-F]{4})/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
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

function parseAgentHandshake(rawLine) {
  const text = String(rawLine ?? "");
  const match = text.match(/BoardManagerAgent:\s+board=(\S+)\s+app=(\S+)\s+version=(\S+)\s+capabilities=(\S+)\s+build=(.+)$/);
  if (!match) {
    return {
      firmwareBoard: null,
      firmwareApp: null,
      firmwareVersion: null,
      firmwareBuildId: null,
      agentCapabilities: [],
    };
  }

  const capabilities = match[4] === "none"
    ? []
    : match[4].split(",").map((entry) => entry.trim()).filter(Boolean).sort();

  return {
    firmwareBoard: match[1],
    firmwareApp: match[2],
    firmwareVersion: match[3],
    firmwareBuildId: match[5],
    agentCapabilities: capabilities,
  };
}

function pickSignatureLine(lines) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("BoardManagerAgent:")) return trimmed;
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

function pickEarlierTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left ?? null;
  return String(left).localeCompare(String(right)) <= 0 ? left : right;
}

function pickLaterTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left ?? null;
  return String(left).localeCompare(String(right)) >= 0 ? left : right;
}

function pickEarlierTransition(left, right) {
  if (!left?.at) return right ?? null;
  if (!right?.at) return left ?? null;
  return String(left.at).localeCompare(String(right.at)) <= 0 ? left : right;
}

function pickLaterTransition(left, right) {
  if (!left?.at) return right ?? null;
  if (!right?.at) return left ?? null;
  return String(left.at).localeCompare(String(right.at)) >= 0 ? left : right;
}

function hasAnnotationContent(annotation) {
  return Boolean(
    annotation?.label
    || annotation?.owner
    || annotation?.location
    || annotation?.purpose
    || (Array.isArray(annotation?.notes) && annotation.notes.length > 0)
  );
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

function mergeTransitionSummary(existing, updates) {
  return {
    firstSeen: existing?.firstSeen ?? updates.firstSeen ?? null,
    lastSeen: updates.lastSeen ?? existing?.lastSeen ?? null,
    lastPresent: updates.lastPresent ?? existing?.lastPresent ?? null,
    lastMissing: updates.lastMissing ?? existing?.lastMissing ?? null,
  };
}


function summarizeRunUnit(unit) {
  return {
    stableKey: unit.identity.stableKey,
    boardId: unit.match.boardId ?? null,
    familyKey: unit.history.familyKey ?? null,
    port: unit.transport.port ?? null,
    usbInstance: unit.transport.usbInstance ?? null,
    firmwareApp: unit.observed.firmwareApp ?? null,
    firmwareVersion: unit.observed.firmwareVersion ?? null,
    firmwareBuildId: unit.observed.firmwareBuildId ?? null,
    firmwareBoard: unit.observed.firmwareBoard ?? null,
    agentCapabilities: unit.observed.agentCapabilities ?? [],
    usbManufacturer: unit.observed.usbDescriptor?.manufacturer ?? null,
    usbProductName: unit.observed.usbDescriptor?.productName ?? null,
    usbService: unit.observed.usbDescriptor?.service ?? null,
    usbRevision: unit.observed.usbDescriptor?.revision ?? null,
    usbBaseSerialNumber: unit.observed.usbDescriptor?.baseSerialNumber ?? null,
    usbTopologyPath: unit.observed.usbDescriptor?.topology?.path ?? null,
    agentLine: unit.observed.agentLine ?? null,
    label: unit.annotation.label ?? null,
  };
}

function summarizeRunFamily(family) {
  return {
    familyKey: family.familyKey,
    boardId: family.boardIds?.length === 1 ? family.boardIds[0] : null,
    presentUnitCount: family.presentUnitCount ?? 0,
    sampleUnitIds: family.sampleUnitIds ?? [],
  };
}

function summarizeConflict(conflict) {
  return {
    conflictId: conflict.conflictId,
    kind: conflict.kind,
    status: conflict.status ?? 'active',
    chosenStableKey: conflict.chosenStableKey ?? null,
    candidateStableKeys: conflict.candidateStableKeys ?? [],
    summary: conflict.summary ?? null,
  };
}

function appendDiscoveryRun(state, units, families, conflicts, timestamp) {
  const existingRuns = Array.isArray(state.runs) ? state.runs : [];
  const nextRun = {
    runId: `run:${timestamp}`,
    generatedAt: timestamp,
    host: {
      platform: "windows",
      hostname: os.hostname(),
    },
    unitCount: units.length,
    familyCount: families.length,
    conflictCount: conflicts.length,
    units: units
      .map(summarizeRunUnit)
      .sort((left, right) => String(left.stableKey).localeCompare(String(right.stableKey))),
    families: families
      .map(summarizeRunFamily)
      .sort((left, right) => String(left.familyKey).localeCompare(String(right.familyKey))),
    conflicts: conflicts
      .map(summarizeConflict)
      .sort((left, right) => String(left.conflictId).localeCompare(String(right.conflictId))),
  };

  state.generatedAt = timestamp;
  state.host = nextRun.host;
  state.runs = [...existingRuns, nextRun].slice(-200);
}
async function readPorts() {
  const command = [
    'Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Description,PNPDeviceID | ConvertTo-Json -Depth 3'
  ].join("\n");
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", command], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  const parsed = JSON.parse(stdout || "[]");
  const ports = Array.isArray(parsed) ? parsed : [parsed];
  return ports.filter((port) => !ignoredPorts.has(String(port?.DeviceID ?? "").trim()));
}

async function readUsbRegistryDescriptor(pnpDeviceId) {
  const match = String(pnpDeviceId ?? "").match(/^USB\\(VID_[0-9A-F]{4}&PID_[0-9A-F]{4}(?:&MI_[0-9A-F]{2})?)\\(.+)$/i);
  if (!match) {
    return null;
  }

  const enumKey = match[1].toUpperCase();
  const instanceId = match[2].toLowerCase();
  const vidPidKey = enumKey.replace(/&MI_[0-9A-F]{2}$/i, "");
  const command = [
    `$enumKey = '${enumKey}'`,
    `$instanceId = '${instanceId}'`,
    `$vidPidKey = '${vidPidKey}'`,
    '$currentPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USB\\" + $enumKey + "\\" + $instanceId',
    '$current = Get-ItemProperty -LiteralPath $currentPath -ErrorAction SilentlyContinue',
    'if ($null -eq $current) { Write-Output "null"; exit 0 }',
    '$containerId = $current.ContainerID',
    '$usbRoot = "Registry::HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Enum\\USB"',
    '$related = @(',
    '  Get-ChildItem -Path $usbRoot -Recurse -ErrorAction SilentlyContinue | ForEach-Object {',
    '    $item = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue',
    '    if ($null -ne $item -and $containerId -and $item.ContainerID -eq $containerId) {',
    '      [pscustomobject]@{',
    '        pnpDeviceId = ($_.PSPath -replace "^Microsoft.PowerShell.Core\\Registry::HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Enum\\", "")',
    '        friendlyName = $item.FriendlyName',
    '        deviceDesc = $item.DeviceDesc',
    '        manufacturer = $item.Mfg',
    '        service = $item.Service',
    '        busReportedDeviceDesc = $item.BusReportedDeviceDesc',
    '        parentIdPrefix = $item.ParentIdPrefix',
    '        enumeratorName = $item.EnumeratorName',
    '        className = $item.Class',
    '        classGuid = $item.ClassGuid',
    '        driver = $item.Driver',
    '        locationInformation = $item.LocationInformation',
    '        hardwareIds = @($item.HardwareID)',
    '        compatibleIds = @($item.CompatibleIDs)',
    '      }',
    '    }',
    '  }',
    ')',
    '$payload = [pscustomobject]@{',
    '  currentPnpDeviceId = "USB\\" + $enumKey + "\\" + $instanceId',
    '  friendlyName = $current.FriendlyName',
    '  deviceDesc = $current.DeviceDesc',
    '  manufacturer = $current.Mfg',
    '  service = $current.Service',
    '  busReportedDeviceDesc = $current.BusReportedDeviceDesc',
    '  parentIdPrefix = $current.ParentIdPrefix',
    '  enumeratorName = $current.EnumeratorName',
    '  className = $current.Class',
    '  classGuid = $current.ClassGuid',
    '  driver = $current.Driver',
    '  locationInformation = $current.LocationInformation',
    '  containerId = $current.ContainerID',
    '  hardwareIds = @($current.HardwareID)',
    '  compatibleIds = @($current.CompatibleIDs)',
    '  related = $related',
    '}',
    '$payload | ConvertTo-Json -Depth 6 -Compress'
  ].join('\n');

  try {
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', command], {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const raw = String(stdout ?? '').trim();
    if (!raw || raw === 'null') {
      return null;
    }

    const parsed = JSON.parse(raw);
    const related = Array.isArray(parsed.related) ? parsed.related : parsed.related ? [parsed.related] : [];
    const relatedInterfaces = related.map((entry) => ({
      pnpDeviceId: entry.pnpDeviceId ?? null,
      friendlyName: parseRegistryLabel(entry.friendlyName),
      deviceDescription: parseRegistryLabel(entry.deviceDesc),
      manufacturer: parseRegistryLabel(entry.manufacturer),
      service: entry.service ?? null,
      productName: pickUsbProductName(entry.busReportedDeviceDesc, entry.friendlyName, entry.deviceDesc),
      parentIdPrefix: entry.parentIdPrefix ?? null,
      enumeratorName: entry.enumeratorName ?? null,
      className: entry.className ?? null,
      classGuid: entry.classGuid ?? null,
      driver: entry.driver ?? null,
      locationInformation: entry.locationInformation ?? null,
      topology: parseUsbTopology(entry.locationInformation),
      hardwareIds: normalizeStringList(entry.hardwareIds),
      compatibleIds: normalizeStringList(entry.compatibleIds),
    }));
    const baseIdentity = relatedInterfaces.find((entry) => /USB\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}\\/i.test(entry.pnpDeviceId ?? '')) ?? null;

    return {
      friendlyName: parseRegistryLabel(parsed.friendlyName),
      deviceDescription: parseRegistryLabel(parsed.deviceDesc),
      manufacturer: parseRegistryLabel(parsed.manufacturer),
      service: parsed.service ?? null,
      productName: pickUsbProductName(parsed.busReportedDeviceDesc, parsed.friendlyName, parsed.deviceDesc),
      parentIdPrefix: parsed.parentIdPrefix ?? null,
      enumeratorName: parsed.enumeratorName ?? null,
      className: parsed.className ?? null,
      classGuid: parsed.classGuid ?? null,
      driver: parsed.driver ?? null,
      revision: parseUsbRevision(parsed.hardwareIds),
      locationInformation: parsed.locationInformation ?? null,
      topology: parseUsbTopology(parsed.locationInformation),
      containerId: parsed.containerId ?? null,
      hardwareIds: normalizeStringList(parsed.hardwareIds),
      compatibleIds: normalizeStringList(parsed.compatibleIds),
      relatedInterfaces,
      relatedServices: uniqueSorted(relatedInterfaces.map((entry) => entry.service)),
      relatedFunctionNames: uniqueSorted(relatedInterfaces.flatMap((entry) => [entry.friendlyName, entry.deviceDescription])),
      basePnpDeviceId: baseIdentity?.pnpDeviceId ?? parsed.currentPnpDeviceId ?? null,
      baseSerialNumber: baseIdentity?.pnpDeviceId
        ? parseSerialFromUsbInstance(baseIdentity.pnpDeviceId)
        : (parsed.currentPnpDeviceId ? parseSerialFromUsbInstance(parsed.currentPnpDeviceId) : null),
    };
  } catch {
    return null;
  }
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
    for (const priorStableKey of identity.priorStableKeys ?? []) {
      if (priorStableKey) byStableKey.set(priorStableKey, unit);
    }
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

function normalizeManualOverride(entry) {
  return {
    boardId: entry?.boardId ?? null,
    familyKey: entry?.familyKey ?? null,
    note: entry?.note ?? null,
    updatedAt: entry?.updatedAt ?? null,
  };
}

function buildOverrideIndex(units) {
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

async function runEspTool(port, chip = "esp32s3") {
  try {
    const { stdout, stderr } = await execFileAsync(espPython, [esptoolPy, "--chip", chip, "-p", port, "read_mac"], {
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
    const agentLine = lines.map((line) => line.trim()).find((line) => line.includes("BoardManagerAgent:")) ?? null;
    const firmwareIdentity = parseFirmwareIdentity(firmwareLine);
    const agentIdentity = parseAgentHandshake(agentLine);
    const identity = {
      firmwareApp: firmwareIdentity.firmwareApp ?? agentIdentity.firmwareApp,
      firmwareVersion: firmwareIdentity.firmwareVersion ?? agentIdentity.firmwareVersion,
      firmwareBuildId: firmwareIdentity.firmwareBuildId ?? agentIdentity.firmwareBuildId,
      firmwareBoard: firmwareIdentity.firmwareBoard ?? agentIdentity.firmwareBoard,
      agentCapabilities: agentIdentity.agentCapabilities,
    };
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
      agentLine,
      firmwareApp: identity.firmwareApp,
      firmwareVersion: identity.firmwareVersion,
      firmwareBuildId: identity.firmwareBuildId,
      firmwareBoard: identity.firmwareBoard,
      agentCapabilities: identity.agentCapabilities,
    };
  } catch {
    return {
      firmwareSignature: null,
      rawSignatureLine: null,
      firmwareLine: null,
      agentLine: null,
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
  const stableKey = deriveStableKey(observed, transport, previousMatch);
  const aliases = new Set(Array.isArray(prior.aliases) ? prior.aliases : []);
  const priorStableKeys = new Set(Array.isArray(prior.priorStableKeys) ? prior.priorStableKeys : []);
  if (transport.port) aliases.add(transport.port);
  if (transport.name) aliases.add(transport.name);
  if (previousMatch?.stableKey && previousMatch.stableKey !== stableKey) priorStableKeys.add(previousMatch.stableKey);
  if (prior.stableKey && prior.stableKey !== stableKey) priorStableKeys.add(prior.stableKey);

  return {
    stableKey,
    usbInstance: observed.usbInstance ?? prior.usbInstance ?? transport.usbInstance ?? null,
    mac: observed.mac ?? prior.mac ?? null,
    serialNumber: observed.serialNumber ?? prior.serialNumber ?? null,
    aliases: Array.from(aliases).sort(),
    priorStableKeys: Array.from(priorStableKeys).sort(),
  };
}

function collectIdentityMatches(observed, transport, indices) {
  const matches = [];
  const seen = new Set();

  const pushMatch = (source, unit) => {
    if (!unit) return;
    const stableKey = unit.stableKey ?? unit.identity?.stableKey ?? null;
    if (!stableKey) return;
    const key = `${source}:${stableKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({
      source,
      stableKey,
      unit,
    });
  };

  if (observed.mac && indices.byMac.has(observed.mac)) pushMatch('mac', indices.byMac.get(observed.mac));
  if (transport.usbInstance && indices.byUsbInstance.has(transport.usbInstance)) pushMatch('usbInstance', indices.byUsbInstance.get(transport.usbInstance));
  if (observed.serialNumber && indices.bySerial.has(observed.serialNumber)) pushMatch('serialNumber', indices.bySerial.get(observed.serialNumber));
  return matches;
}

export function detectIdentityConflict(observed, transport, indices) {
  const matches = collectIdentityMatches(observed, transport, indices);
  const stableKeys = uniqueSorted(matches.map((entry) => entry.stableKey));
  if (stableKeys.length <= 1) {
    return null;
  }

  const chosenStableKey = matches.find((entry) => entry.source == 'mac')?.stableKey
    ?? matches.find((entry) => entry.source == 'usbInstance')?.stableKey
    ?? matches[0]?.stableKey
    ?? null;

  const evidence = {
    port: transport.port ?? null,
    usbInstance: transport.usbInstance ?? observed.usbInstance ?? null,
    serialNumber: observed.serialNumber ?? null,
    mac: observed.mac ?? null,
    vid: observed.vid ?? null,
    pid: observed.pid ?? null,
  };

  const idText = [
    'identity-evidence-mismatch',
    chosenStableKey ?? 'unknown',
    stableKeys.join('|'),
    evidence.usbInstance ?? 'no-usb',
    evidence.mac ?? 'no-mac',
    evidence.serialNumber ?? 'no-serial',
  ].join('|');

  return {
    conflictId: `conflict_${sanitizeSegment(idText)}`,
    kind: 'identity-evidence-mismatch',
    chosenStableKey,
    candidateStableKeys: stableKeys,
    evidence,
    matches: matches.map((entry) => ({
      source: entry.source,
      stableKey: entry.stableKey,
    })),
    summary: `Identity evidence disagrees for ${transport.port ?? chosenStableKey ?? 'unit'}: ${stableKeys.join(' vs ')}`,
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
  const { mac, firmwareSignature, rawSignatureLine, firmwareBoard, usbDescriptor } = unit.observed;

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

  if ((usbDescriptor?.manufacturer === "STMicroelectronics")
    && unit.observed.vid === "0483"
    && unit.observed.pid === "374B"
    && usbDescriptor?.service === "usbser") {
    return {
      status: "matched",
      boardId: "p_nucleo_usb001_f072rb_v1",
      reason: "STMicroelectronics USB registry identity and STLink VCP VID/PID match the attached P-NUCLEO-USB001 / Nucleo-F072RB",
      source: "usb-registry"
    };
  }

  if ((usbDescriptor?.manufacturer === "STMicroelectronics")
    && (usbDescriptor?.relatedServices ?? []).includes("WinUSB")
    && (usbDescriptor?.relatedServices ?? []).includes("USBSTOR")
    && ((usbDescriptor?.relatedFunctionNames ?? []).some((entry) => String(entry).includes("ST-Link Debug"))
      || (usbDescriptor?.relatedFunctionNames ?? []).some((entry) => String(entry).includes("STLink Virtual COM Port")))) {
    return {
      status: "matched",
      boardId: "p_nucleo_usb001_f072rb_v1",
      reason: "Composite STLink debug, mass-storage, and VCP interfaces match the attached P-NUCLEO-USB001 / Nucleo-F072RB",
      source: "usb-registry"
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
      capabilities: unit.observed.agentCapabilities ?? [],
      manufacturer: unit.observed.usbDescriptor?.manufacturer ?? null,
      productName: unit.observed.usbDescriptor?.productName ?? null,
      service: unit.observed.usbDescriptor?.service ?? null,
      revision: unit.observed.usbDescriptor?.revision ?? null,
      containerId: unit.observed.usbDescriptor?.containerId ?? null,
      locationInformation: unit.observed.usbDescriptor?.locationInformation ?? null,
      baseUsbIdentity: unit.observed.usbDescriptor?.basePnpDeviceId ?? null,
      relatedServices: unit.observed.usbDescriptor?.relatedServices ?? [],
      relatedFunctionNames: unit.observed.usbDescriptor?.relatedFunctionNames ?? [],
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
      capabilities: unit.observed.agentCapabilities ?? [],
      manufacturer: unit.observed.usbDescriptor?.manufacturer ?? null,
      productName: unit.observed.usbDescriptor?.productName ?? null,
      service: unit.observed.usbDescriptor?.service ?? null,
      revision: unit.observed.usbDescriptor?.revision ?? null,
      containerId: unit.observed.usbDescriptor?.containerId ?? null,
      locationInformation: unit.observed.usbDescriptor?.locationInformation ?? null,
      baseUsbIdentity: unit.observed.usbDescriptor?.basePnpDeviceId ?? null,
      relatedServices: unit.observed.usbDescriptor?.relatedServices ?? [],
      relatedFunctionNames: unit.observed.usbDescriptor?.relatedFunctionNames ?? [],
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
    capabilities: unit.observed.agentCapabilities ?? [],
    manufacturer: unit.observed.usbDescriptor?.manufacturer ?? null,
    service: unit.observed.usbDescriptor?.service ?? null,
    containerId: unit.observed.usbDescriptor?.containerId ?? null,
    locationInformation: unit.observed.usbDescriptor?.locationInformation ?? null,
    baseUsbIdentity: unit.observed.usbDescriptor?.basePnpDeviceId ?? null,
    relatedServices: unit.observed.usbDescriptor?.relatedServices ?? [],
    relatedFunctionNames: unit.observed.usbDescriptor?.relatedFunctionNames ?? [],
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
  const candidateKeys = [unit.identity.stableKey, ...(unit.identity.priorStableKeys ?? [])].filter(Boolean);
  const entry = candidateKeys.map((key) => annotationIndex.byStableKey.get(key)).find(Boolean) ?? null;
  unit.annotation = normalizeAnnotation(entry);
}

function attachManualOverride(unit, overrideIndex) {
  const candidateKeys = [unit.identity.stableKey, ...(unit.identity.priorStableKeys ?? [])].filter(Boolean);
  const entry = candidateKeys.map((key) => overrideIndex.byStableKey.get(key)).find(Boolean) ?? null;
  unit.manualOverride = normalizeManualOverride(entry);
}

function applyManualOverride(unit) {
  const override = unit.manualOverride ?? {};
  if (override.boardId) {
    unit.match = {
      status: "matched",
      boardId: override.boardId,
      reason: override.note ? `Manual board override: ${override.note}` : "Manual board override",
      source: "manual-override",
    };
    return {
      familyKey: `board:${override.boardId}`,
      profileId: `board_${sanitizeSegment(override.boardId)}`,
      forced: true,
    };
  }

  if (override.familyKey) {
    return {
      familyKey: override.familyKey,
      profileId: sanitizeSegment(override.familyKey),
      forced: true,
    };
  }

  return null;
}

async function observePort(portInfo, unitIndex, familyIndex, annotationIndex, overrideIndex) {
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
    agentLine: null,
    firmwareApp: null,
    firmwareVersion: null,
    firmwareBuildId: null,
    firmwareBoard: null,
    agentCapabilities: [],
    usbDescriptor: null,
  };

  observed.usbDescriptor = await readUsbRegistryDescriptor(portInfo.PNPDeviceID);
  observed.serialNumber = observed.usbDescriptor?.baseSerialNumber ?? observed.serialNumber;

  const isNativeEspUsb = (vidPid.vid === "303A" && vidPid.pid === "1001") || (transport.name ?? "").includes("USB Serial Device");
  const isEspBridge = vidPid.vid === "10C4" && vidPid.pid === "EA60";
  if (isNativeEspUsb || isEspBridge) {
    const toolOutput = await runEspTool(transport.port, isNativeEspUsb ? "esp32s3" : "auto");
    observed.mac = parseMac(toolOutput) ?? observed.mac;
    observed.chip = parseChip(toolOutput);
    const signature = await captureSignature(transport.port);
    observed.firmwareSignature = signature.firmwareSignature;
    observed.rawSignatureLine = signature.rawSignatureLine;
    observed.firmwareLine = signature.firmwareLine;
    observed.agentLine = signature.agentLine;
    observed.firmwareApp = signature.firmwareApp;
    observed.firmwareVersion = signature.firmwareVersion;
    observed.firmwareBuildId = signature.firmwareBuildId;
    observed.firmwareBoard = signature.firmwareBoard;
    observed.agentCapabilities = signature.agentCapabilities;
  }

  const previousUnit = findPreviousUnit(observed, transport, unitIndex);
  const identityConflict = detectIdentityConflict(observed, transport, unitIndex);
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
      agentLine: observed.agentLine,
      firmwareApp: observed.firmwareApp,
      firmwareVersion: observed.firmwareVersion,
      firmwareBuildId: observed.firmwareBuildId,
      firmwareBoard: observed.firmwareBoard,
      agentCapabilities: observed.agentCapabilities,
      usbDescriptor: observed.usbDescriptor,
    },
    annotation: normalizeAnnotation(null),
    match: { status: "unknown", boardId: null, reason: null, source: null },
    history: { status: "unknown", familyKey: "unknown", profileId: null, firstSeenAt: null, lastSeenAt: null, seenCount: null, reason: null },
    manualOverride: normalizeManualOverride(null)
  };

  attachAnnotation(unit, annotationIndex);
  attachManualOverride(unit, overrideIndex);
  unit.match = basicHeuristicMatch(unit);
  const heuristicFamilyFingerprint = deriveFamilyFingerprint(unit);
  const heuristicFamily = familyIndex.byFamilyKey.get(heuristicFamilyFingerprint.familyKey) ?? familyIndex.byFingerprintKey.get(heuristicFamilyFingerprint.fingerprintKey) ?? null;
  const learnedMatch = resolveMatch(unit, previousUnit, heuristicFamily);
  const learnedFamilyFingerprint = learnedMatch.boardId
    ? deriveFamilyFingerprint({ ...unit, match: { ...learnedMatch } })
    : heuristicFamilyFingerprint;
  const learnedFamily = familyIndex.byFamilyKey.get(learnedFamilyFingerprint.familyKey) ?? familyIndex.byFingerprintKey.get(learnedFamilyFingerprint.fingerprintKey) ?? null;

  unit.match = { ...learnedMatch };
  const manualOverride = applyManualOverride(unit);
  const effectiveFamilyFingerprint = manualOverride?.forced
    ? {
        ...learnedFamilyFingerprint,
        familyKey: manualOverride.familyKey ?? learnedFamilyFingerprint.familyKey,
        profileId: manualOverride.profileId ?? learnedFamilyFingerprint.profileId,
        status: unit.match.boardId ? "known-board" : learnedFamilyFingerprint.status,
        fingerprintKey: unit.match.boardId ? `board:${unit.match.boardId}` : learnedFamilyFingerprint.fingerprintKey,
      }
    : learnedFamilyFingerprint;
  const historyStatus = buildHistoryStatus(previousUnit, learnedFamily);

  unit.history = {
    status: historyStatus.status,
    familyKey: effectiveFamilyFingerprint.familyKey,
    profileId: effectiveFamilyFingerprint.profileId,
    firstSeenAt: previousUnit?.firstSeenAt ?? learnedFamily?.firstSeenAt ?? null,
    lastSeenAt: previousUnit?.lastSeenAt ?? learnedFamily?.lastSeenAt ?? null,
    seenCount: previousUnit?.seenCount ?? null,
    reason: historyStatus.reason,
  };

  return { unit, familyFingerprint: effectiveFamilyFingerprint, historyFamilyFingerprint: learnedFamilyFingerprint, historyMatch: learnedMatch, previousUnit, identityConflict };
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
    agentLines: uniqueSorted([...(existing?.agentLines ?? []), unit.observed.agentLine]),
    agentCapabilitySets: uniqueSorted([...(existing?.agentCapabilitySets ?? []), (unit.observed.agentCapabilities ?? []).join(",")]),
    usbManufacturers: uniqueSorted([...(existing?.usbManufacturers ?? []), unit.observed.usbDescriptor?.manufacturer]),
    usbProductNames: uniqueSorted([...(existing?.usbProductNames ?? []), unit.observed.usbDescriptor?.productName]),
    usbServices: uniqueSorted([...(existing?.usbServices ?? []), unit.observed.usbDescriptor?.service, ...(unit.observed.usbDescriptor?.relatedServices ?? [])]),
    usbRevisions: uniqueSorted([...(existing?.usbRevisions ?? []), unit.observed.usbDescriptor?.revision]),
    usbContainerIds: uniqueSorted([...(existing?.usbContainerIds ?? []), unit.observed.usbDescriptor?.containerId]),
    usbLocationInformation: uniqueSorted([...(existing?.usbLocationInformation ?? []), unit.observed.usbDescriptor?.locationInformation]),
    usbBaseIdentities: uniqueSorted([...(existing?.usbBaseIdentities ?? []), unit.observed.usbDescriptor?.basePnpDeviceId]),
    usbBaseSerialNumbers: uniqueSorted([...(existing?.usbBaseSerialNumbers ?? []), unit.observed.usbDescriptor?.baseSerialNumber]),
    usbParentIdPrefixes: uniqueSorted([...(existing?.usbParentIdPrefixes ?? []), unit.observed.usbDescriptor?.parentIdPrefix]),
    usbEnumeratorNames: uniqueSorted([...(existing?.usbEnumeratorNames ?? []), unit.observed.usbDescriptor?.enumeratorName]),
    usbClassNames: uniqueSorted([...(existing?.usbClassNames ?? []), unit.observed.usbDescriptor?.className]),
    usbDrivers: uniqueSorted([...(existing?.usbDrivers ?? []), unit.observed.usbDescriptor?.driver]),
    usbTopologyPaths: uniqueSorted([...(existing?.usbTopologyPaths ?? []), unit.observed.usbDescriptor?.topology?.path]),
    usbTopologyKinds: uniqueSorted([...(existing?.usbTopologyKinds ?? []), unit.observed.usbDescriptor?.topology?.kind]),
    usbFunctionNames: uniqueSorted([...(existing?.usbFunctionNames ?? []), ...(unit.observed.usbDescriptor?.relatedFunctionNames ?? [])]),
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


function mergeObservedSnapshots(primary, secondary) {
  const result = {};
  const keys = new Set([
    ...Object.keys(primary ?? {}),
    ...Object.keys(secondary ?? {}),
  ]);

  for (const key of keys) {
    const left = primary?.[key];
    const right = secondary?.[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      result[key] = uniqueSorted([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]);
    } else {
      result[key] = left ?? right ?? null;
    }
  }

  return result;
}

function mergeMetadataHistorySnapshots(primary, secondary) {
  const primaryEntries = Array.isArray(primary?.entries) ? primary.entries : [];
  const secondaryEntries = Array.isArray(secondary?.entries) ? secondary.entries : [];
  const mergedEntries = Array.from(
    new Map(
      [...primaryEntries, ...secondaryEntries].map((entry) => [JSON.stringify(entry), entry])
    ).values()
  ).sort((left, right) => String(left.updatedAt ?? "").localeCompare(String(right.updatedAt ?? "")));

  return {
    owners: uniqueSorted([...(primary?.owners ?? []), ...(secondary?.owners ?? [])]),
    locations: uniqueSorted([...(primary?.locations ?? []), ...(secondary?.locations ?? [])]),
    purposes: uniqueSorted([...(primary?.purposes ?? []), ...(secondary?.purposes ?? [])]),
    firstUpdatedAt: pickEarlierTimestamp(primary?.firstUpdatedAt ?? null, secondary?.firstUpdatedAt ?? null),
    lastUpdatedAt: pickLaterTimestamp(primary?.lastUpdatedAt ?? null, secondary?.lastUpdatedAt ?? null),
    entries: mergedEntries,
  };
}

function normalizeHistoricalBoardIds(existingBoardIds, existingManualOverride, currentMatch, currentManualOverride) {
  const staleManualBoardId = (!currentManualOverride?.boardId || currentManualOverride.boardId !== existingManualOverride?.boardId)
    ? (existingManualOverride?.boardId ?? null)
    : null;
  const retained = (existingBoardIds ?? []).filter((boardId) => boardId && boardId !== staleManualBoardId);
  if (currentMatch?.boardId && currentMatch.source !== "manual-override") {
    retained.push(currentMatch.boardId);
  }
  return uniqueSorted(retained);
}

function mergeIdentitySnapshots(primary, secondary, stableKey) {
  const aliases = uniqueSorted([...(primary?.aliases ?? []), ...(secondary?.aliases ?? [])]);
  const priorStableKeys = uniqueSorted([
    ...(primary?.priorStableKeys ?? []),
    ...(secondary?.priorStableKeys ?? []),
    primary?.stableKey,
    secondary?.stableKey,
  ].filter((entry) => entry && entry !== stableKey));

  return {
    stableKey,
    usbInstance: primary?.usbInstance ?? secondary?.usbInstance ?? null,
    mac: primary?.mac ?? secondary?.mac ?? null,
    serialNumber: primary?.serialNumber ?? secondary?.serialNumber ?? null,
    aliases,
    priorStableKeys,
  };
}

function mergeExistingUnits(primary, secondary, stableKey) {
  const primaryLastSeen = primary?.lastSeenAt ?? null;
  const secondaryLastSeen = secondary?.lastSeenAt ?? null;
  const latestTransport = pickLaterTimestamp(primaryLastSeen, secondaryLastSeen) === secondaryLastSeen
    ? (secondary?.lastTransport ?? primary?.lastTransport ?? null)
    : (primary?.lastTransport ?? secondary?.lastTransport ?? null);

  return {
    stableKey,
    firstSeenAt: pickEarlierTimestamp(primary?.firstSeenAt ?? null, secondary?.firstSeenAt ?? null),
    lastSeenAt: pickLaterTimestamp(primaryLastSeen, secondaryLastSeen),
    lastPresentAt: pickLaterTimestamp(primary?.lastPresentAt ?? null, secondary?.lastPresentAt ?? null),
    lastMissingAt: pickLaterTimestamp(primary?.lastMissingAt ?? null, secondary?.lastMissingAt ?? null),
    present: (primary?.present !== false) || (secondary?.present !== false),
    missingCount: (primary?.missingCount ?? 0) + (secondary?.missingCount ?? 0),
    seenCount: (primary?.seenCount ?? 0) + (secondary?.seenCount ?? 0),
    familyKey: primary?.familyKey ?? secondary?.familyKey ?? null,
    profileId: primary?.profileId ?? secondary?.profileId ?? null,
    boardIds: uniqueSorted([...(primary?.boardIds ?? []), ...(secondary?.boardIds ?? [])]),
    identity: mergeIdentitySnapshots(primary?.identity, secondary?.identity, stableKey),
    annotation: hasAnnotationContent(primary?.annotation) ? primary.annotation : (secondary?.annotation ?? normalizeAnnotation(null)),
    manualOverride: primary?.manualOverride?.boardId || primary?.manualOverride?.familyKey || primary?.manualOverride?.note || primary?.manualOverride?.updatedAt
      ? primary.manualOverride
      : (secondary?.manualOverride ?? normalizeManualOverride(null)),
    metadataHistory: mergeMetadataHistorySnapshots(primary?.metadataHistory, secondary?.metadataHistory),
    transitions: {
      firstSeen: pickEarlierTransition(primary?.transitions?.firstSeen ?? null, secondary?.transitions?.firstSeen ?? null),
      lastSeen: pickLaterTransition(primary?.transitions?.lastSeen ?? null, secondary?.transitions?.lastSeen ?? null),
      lastPresent: pickLaterTransition(primary?.transitions?.lastPresent ?? null, secondary?.transitions?.lastPresent ?? null),
      lastMissing: pickLaterTransition(primary?.transitions?.lastMissing ?? null, secondary?.transitions?.lastMissing ?? null),
    },
    lastTransport: latestTransport,
    observed: mergeObservedSnapshots(primary?.observed, secondary?.observed),
  };
}

function buildReconciledExistingUnit(units, identity, previousUnit) {
  const stableKey = identity.stableKey;
  const candidateIndices = [];

  for (let index = 0; index < units.length; index += 1) {
    const entry = units[index];
    const entryIdentity = entry.identity ?? {};
    const matchesStableKey = entry.stableKey === stableKey;
    const matchesPreviousStableKey = Boolean(previousUnit?.stableKey) && entry.stableKey === previousUnit.stableKey;
    const matchesPriorStableKey = (previousUnit?.identity?.priorStableKeys ?? []).includes(entry.stableKey);
    const matchesUsbInstance = Boolean(identity.usbInstance) && entryIdentity.usbInstance === identity.usbInstance;
    const matchesSerialNumber = Boolean(identity.serialNumber) && entryIdentity.serialNumber === identity.serialNumber;
    const strongerIdentityUpgrade = (matchesUsbInstance || matchesSerialNumber)
      && entry.stableKey !== stableKey
      && Boolean(identity.mac || identity.serialNumber);

    if (matchesStableKey || matchesPreviousStableKey || matchesPriorStableKey || strongerIdentityUpgrade) {
      candidateIndices.push(index);
    }
  }

  const uniqueCandidateIndices = Array.from(new Set(candidateIndices)).sort((left, right) => left - right);
  if (uniqueCandidateIndices.length === 0) {
    return { existingUnit: null, candidateIndices: uniqueCandidateIndices };
  }

  let existingUnit = units[uniqueCandidateIndices[0]];
  for (let index = 1; index < uniqueCandidateIndices.length; index += 1) {
    existingUnit = mergeExistingUnits(existingUnit, units[uniqueCandidateIndices[index]], stableKey);
  }

  return { existingUnit, candidateIndices: uniqueCandidateIndices };
}

async function updateHistory(state, unit, familyFingerprint, historyFamilyFingerprint, historyMatch, timestamp, boardCatalog, previousUnit = null) {
  const units = Array.isArray(state.units) ? state.units : [];
  const families = Array.isArray(state.families) ? state.families : [];
  const familyIndex = families.findIndex((entry) => entry.familyKey === historyFamilyFingerprint.familyKey);
  const { existingUnit, candidateIndices } = buildReconciledExistingUnit(units, unit.identity, previousUnit);

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
    familyKey: historyFamilyFingerprint.familyKey,
    profileId: historyFamilyFingerprint.profileId,
    boardIds: normalizeHistoricalBoardIds(existingUnit?.boardIds ?? [], existingUnit?.manualOverride, historyMatch, unit.manualOverride),
    identity: mergeIdentitySnapshots(unit.identity, existingUnit?.identity, unit.identity.stableKey),
    annotation: hasAnnotationContent(unit.annotation) ? unit.annotation : normalizeAnnotation(existingUnit?.annotation),
    manualOverride: unit.manualOverride?.boardId || unit.manualOverride?.familyKey || unit.manualOverride?.note || unit.manualOverride?.updatedAt
      ? unit.manualOverride
      : normalizeManualOverride(null),
    metadataHistory: mergeMetadataHistory(existingUnit?.metadataHistory, unit.annotation, timestamp),
    transitions: mergeTransitionSummary(existingUnit?.transitions, {
      firstSeen: existingUnit?.transitions?.firstSeen ?? { at: existingUnit?.firstSeenAt ?? timestamp, state: "discovered" },
      lastSeen: { at: timestamp, state: "observed" },
      lastPresent: { at: timestamp, state: "present" },
      lastMissing: existingUnit?.transitions?.lastMissing ?? null,
    }),
    lastTransport: unit.transport,
    observed: mergeObservedHistory(existingUnit?.observed, unit),
  };

  for (const index of [...candidateIndices].sort((left, right) => right - left)) {
    units.splice(index, 1);
  }
  units.push(nextUnit);

  const nextFamily = {
    familyKey: historyFamilyFingerprint.familyKey,
    firstSeenAt: existingFamily?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    lastPresentAt: existingFamily?.lastPresentAt ?? timestamp,
    lastMissingAt: existingFamily?.lastMissingAt ?? null,
    present: true,
    presentUnitCount: existingFamily?.presentUnitCount ?? 0,
    missingUnitCount: existingFamily?.missingUnitCount ?? 0,
    seenCount: (existingFamily?.seenCount ?? 0) + 1,
    status: historyFamilyFingerprint.status,
    profileId: historyFamilyFingerprint.profileId,
    boardIds: normalizeHistoricalBoardIds(existingFamily?.boardIds ?? [], { boardId: existingUnit?.manualOverride?.boardId ?? null }, historyMatch, unit.manualOverride),
    sampleUnitIds: uniqueSorted([...(existingFamily?.sampleUnitIds ?? []), unit.identity.stableKey]).slice(0, 16),
    transitions: mergeTransitionSummary(existingFamily?.transitions, {
      firstSeen: existingFamily?.transitions?.firstSeen ?? { at: existingFamily?.firstSeenAt ?? timestamp, state: "discovered" },
      lastSeen: { at: timestamp, state: "observed" },
      lastPresent: existingFamily?.transitions?.lastPresent ?? { at: timestamp, state: "present" },
      lastMissing: existingFamily?.transitions?.lastMissing ?? null,
    }),
    fingerprint: {
      fingerprintKey: historyFamilyFingerprint.fingerprintKey,
      vid: historyFamilyFingerprint.vid,
      pid: historyFamilyFingerprint.pid,
      chipFamily: historyFamilyFingerprint.chipFamily,
      chip: historyFamilyFingerprint.chip,
      description: historyFamilyFingerprint.description,
      name: historyFamilyFingerprint.name,
      firmwareSignature: historyFamilyFingerprint.firmwareSignature,
      capabilities: historyFamilyFingerprint.capabilities ?? [],
      manufacturer: historyFamilyFingerprint.manufacturer ?? null,
      service: historyFamilyFingerprint.service ?? null,
      containerId: historyFamilyFingerprint.containerId ?? null,
      locationInformation: historyFamilyFingerprint.locationInformation ?? null,
      baseUsbIdentity: historyFamilyFingerprint.baseUsbIdentity ?? null,
      relatedServices: historyFamilyFingerprint.relatedServices ?? [],
      relatedFunctionNames: historyFamilyFingerprint.relatedFunctionNames ?? [],
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
    unit.transitions = mergeTransitionSummary(unit.transitions, {
      firstSeen: unit.transitions?.firstSeen ?? { at: unit.firstSeenAt ?? timestamp, state: "discovered" },
      lastSeen: unit.transitions?.lastSeen ?? (unit.lastSeenAt ? { at: unit.lastSeenAt, state: "observed" } : null),
      lastPresent: unit.transitions?.lastPresent ?? (unit.lastPresentAt ? { at: unit.lastPresentAt, state: "present" } : null),
      lastMissing: wasPresent ? { at: timestamp, state: "missing" } : (unit.transitions?.lastMissing ?? { at: unit.lastMissingAt ?? timestamp, state: "missing" }),
    });
  }
}

function refreshFamilyTransitions(state, timestamp, observedStableKeys) {
  const units = Array.isArray(state.units) ? state.units : [];
  const families = Array.isArray(state.families) ? state.families : [];
  const observedFamilies = new Set();

  for (const unit of units) {
    if (observedStableKeys.has(unit.stableKey)) observedFamilies.add(unit.familyKey);
  }

  for (const family of families) {
    const familyUnits = units.filter((unit) => unit.familyKey === family.familyKey);
    const presentUnits = familyUnits.filter((unit) => unit.present !== false);
    const missingUnits = familyUnits.filter((unit) => unit.present === false);
    const wasPresent = family.present !== false;
    const isPresent = presentUnits.length > 0;
    const latestPresentAt = presentUnits.map((unit) => unit.lastPresentAt).filter(Boolean).sort().at(-1) ?? family.lastPresentAt ?? null;
    const latestMissingAt = missingUnits.map((unit) => unit.lastMissingAt).filter(Boolean).sort().at(-1) ?? family.lastMissingAt ?? null;

    family.present = isPresent;
    family.presentUnitCount = presentUnits.length;
    family.missingUnitCount = missingUnits.length;
    family.sampleUnitIds = uniqueSorted(familyUnits.map((unit) => unit.stableKey)).slice(0, 16);
    if (observedFamilies.has(family.familyKey)) family.lastSeenAt = timestamp;
    family.lastPresentAt = isPresent ? latestPresentAt : (family.lastPresentAt ?? latestPresentAt ?? null);
    family.lastMissingAt = !isPresent && familyUnits.length > 0 && wasPresent
      ? timestamp
      : (latestMissingAt ?? family.lastMissingAt ?? null);
    family.transitions = mergeTransitionSummary(family.transitions, {
      firstSeen: family.transitions?.firstSeen ?? { at: family.firstSeenAt ?? timestamp, state: "discovered" },
      lastSeen: observedFamilies.has(family.familyKey) ? { at: family.lastSeenAt ?? timestamp, state: "observed" } : (family.transitions?.lastSeen ?? null),
      lastPresent: isPresent && family.lastPresentAt ? { at: family.lastPresentAt, state: "present" } : (family.transitions?.lastPresent ?? null),
      lastMissing: !isPresent && family.lastMissingAt ? { at: family.lastMissingAt, state: "missing" } : (family.transitions?.lastMissing ?? null),
    });
  }
}

function updateConflictLedger(state, conflict, timestamp) {
  const conflicts = Array.isArray(state.conflicts) ? state.conflicts : [];
  const conflictIndex = conflicts.findIndex((entry) => entry.conflictId === conflict.conflictId);
  const existingConflict = conflictIndex >= 0 ? conflicts[conflictIndex] : null;
  const nextConflict = {
    conflictId: conflict.conflictId,
    kind: conflict.kind,
    status: 'active',
    firstSeenAt: existingConflict?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    count: (existingConflict?.count ?? 0) + 1,
    chosenStableKey: conflict.chosenStableKey ?? null,
    candidateStableKeys: uniqueSorted([...(existingConflict?.candidateStableKeys ?? []), ...(conflict.candidateStableKeys ?? [])]),
    evidence: {
      port: conflict.evidence?.port ?? existingConflict?.evidence?.port ?? null,
      usbInstance: conflict.evidence?.usbInstance ?? existingConflict?.evidence?.usbInstance ?? null,
      serialNumber: conflict.evidence?.serialNumber ?? existingConflict?.evidence?.serialNumber ?? null,
      mac: conflict.evidence?.mac ?? existingConflict?.evidence?.mac ?? null,
      vid: conflict.evidence?.vid ?? existingConflict?.evidence?.vid ?? null,
      pid: conflict.evidence?.pid ?? existingConflict?.evidence?.pid ?? null,
    },
    matches: Array.from(new Map([...(existingConflict?.matches ?? []), ...(conflict.matches ?? [])].map((entry) => [`${entry.source}:${entry.stableKey}`, entry])).values()),
    summary: conflict.summary ?? existingConflict?.summary ?? null,
    lastResolvedAt: existingConflict?.lastResolvedAt ?? null,
  };

  if (conflictIndex >= 0) conflicts[conflictIndex] = nextConflict;
  else conflicts.push(nextConflict);

  state.conflicts = conflicts.sort((left, right) => String(left.conflictId).localeCompare(String(right.conflictId)));
}

function refreshConflictStatus(state, observedConflictIds, timestamp) {
  const conflicts = Array.isArray(state.conflicts) ? state.conflicts : [];
  for (const conflict of conflicts) {
    if (observedConflictIds.has(conflict.conflictId)) {
      conflict.status = 'active';
      continue;
    }

    if (conflict.status !== 'resolved') {
      conflict.status = 'resolved';
      conflict.lastResolvedAt = timestamp;
    }
  }
}

async function main() {
  const ports = await readPorts();
  const boardCatalog = await loadBoardCatalog(projectRoot);
  const annotationsState = await readJsonOrDefault(annotationsPath, { updatedAt: null, units: [] });
  const annotationIndex = buildAnnotationIndex(annotationsState.units ?? []);
  const overridesState = await readJsonOrDefault(overridesPath, { updatedAt: null, units: [] });
  const overrideIndex = buildOverrideIndex(overridesState.units ?? []);
  const historyState = await readJsonOrDefault(unitHistoryPath, {
    generatedAt: null,
    host: { platform: "windows", hostname: null },
    units: [],
    families: [],
    conflicts: [],
  });
  const discoveryRunsState = await readJsonOrDefault(discoveryRunsPath, {
    generatedAt: null,
    host: { platform: "windows", hostname: null },
    runs: [],
  });

  const units = [];
  const observedStableKeys = new Set();
  const observedConflictIds = new Set();
  const timestamp = new Date().toISOString();

  for (const portInfo of ports) {
    const unitIndex = buildIdentityIndex(historyState.units ?? []);
    const familyIndex = buildFamilyIndex(historyState.families ?? []);
    const { unit, familyFingerprint, historyFamilyFingerprint, historyMatch, previousUnit, identityConflict } = await observePort(portInfo, unitIndex, familyIndex, annotationIndex, overrideIndex);
    observedStableKeys.add(unit.identity.stableKey);
    await updateHistory(historyState, unit, familyFingerprint, historyFamilyFingerprint, historyMatch, timestamp, boardCatalog, previousUnit);
    if (identityConflict) {
      updateConflictLedger(historyState, identityConflict, timestamp);
      observedConflictIds.add(identityConflict.conflictId);
    }
    units.push(unit);
  }

  markMissingUnits(historyState, observedStableKeys, timestamp);
  refreshFamilyTransitions(historyState, timestamp, observedStableKeys);
  refreshConflictStatus(historyState, observedConflictIds, timestamp);

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
  historyState.conflicts = Array.isArray(historyState.conflicts) ? historyState.conflicts : [];

  appendDiscoveryRun(
    discoveryRunsState,
    units,
    (historyState.families ?? []).filter((family) => family.present !== false),
    (historyState.conflicts ?? []).filter((conflict) => conflict.status !== 'resolved'),
    timestamp
  );

  await mkdir(path.dirname(inventoryPath), { recursive: true });
  await mkdir(path.dirname(unitHistoryPath), { recursive: true });
  await mkdir(path.dirname(discoveryRunsPath), { recursive: true });
  await writeFile(inventoryPath, `${JSON.stringify(inventoryPayload, null, 2)}\n`, "utf8");
  await writeFile(unitHistoryPath, `${JSON.stringify(historyState, null, 2)}\n`, "utf8");
  await writeFile(discoveryRunsPath, `${JSON.stringify(discoveryRunsState, null, 2)}\n`, "utf8");

  console.log(`Discovered ${units.length} units.`);
  for (const unit of units) {
    const labelSuffix = unit.annotation.label ? ` label='${unit.annotation.label}'` : "";
    const firmwareSuffix = unit.observed.firmwareVersion ? ` fw=${unit.observed.firmwareApp}@${unit.observed.firmwareVersion}` : "";
    console.log(`${unit.transport.port}: ${unit.match.boardId ?? "unmatched"} [${unit.identity.stableKey}] (${unit.history.status}; ${unit.history.reason})${firmwareSuffix}${labelSuffix}`);
  }
}

export { buildIdentityIndex, deriveFamilyFingerprint, markMissingUnits, refreshFamilyTransitions, appendDiscoveryRun };

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}











