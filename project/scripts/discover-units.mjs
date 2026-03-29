import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
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
const espPython = path.join(projectRoot, "tools", "espressif", "python_env", "idf5.5_py3.13_env", "Scripts", "python.exe");
const esptoolPy = path.join(projectRoot, "toolchains", "esp-idf", "esp-idf", "components", "esptool_py", "esptool", "esptool.py");

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

function pickSignatureLine(lines) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("Board Manager dial smoke test starting")) return trimmed;
    if (trimmed.includes("Board Manager CoreS3 GNSS bring-up starting")) return trimmed;
    if (trimmed.includes("Board Manager")) return trimmed;
    if (trimmed.includes("Live inputs:")) return trimmed;
    if (trimmed.includes("Live GNSS PPS state:")) return trimmed;
    if (trimmed.includes("stamp_ring_factory_test")) return trimmed;
  }
  return lines.map((line) => line.trim()).find(Boolean) ?? null;
}

async function readPorts() {
  const command = "Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Description,PNPDeviceID | ConvertTo-Json -Depth 3";
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", command], {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  const parsed = JSON.parse(stdout || "[]");
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function loadPreviousInventory() {
  try {
    const text = await readFile(inventoryPath, "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.units) ? parsed.units : [];
  } catch {
    return [];
  }
}

function buildPreviousIdentityIndex(previousUnits) {
  const byMac = new Map();
  const byUsbInstance = new Map();
  const bySerial = new Map();

  for (const unit of previousUnits) {
    const identity = unit.identity ?? {};
    if (identity.mac) byMac.set(identity.mac, unit);
    if (identity.usbInstance) byUsbInstance.set(identity.usbInstance, unit);
    if (identity.serialNumber) bySerial.set(identity.serialNumber, unit);
  }

  return { byMac, byUsbInstance, bySerial };
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
    let firmwareSignature = null;
    if (rawSignatureLine) {
      if (rawSignatureLine.includes("Board Manager dial smoke test starting")) firmwareSignature = "board_manager_dial_smoketest";
      else if (rawSignatureLine.includes("Board Manager CoreS3 GNSS bring-up starting")) firmwareSignature = "board_manager_cores3_gnss_demo";
      else if (rawSignatureLine.includes("Live GNSS PPS state:")) firmwareSignature = "board_manager_cores3_gnss_demo";
      else if (rawSignatureLine.includes("Live inputs:")) firmwareSignature = "board_manager_dial_smoketest";
      else if (rawSignatureLine.includes("stamp_ring_factory_test")) firmwareSignature = "m5_factory_stamp_ring_test";
      else if (rawSignatureLine.includes("Board Manager")) firmwareSignature = "board_manager_boot_banner";
    }
    return { firmwareSignature, rawSignatureLine };
  } catch {
    return { firmwareSignature: null, rawSignatureLine: null };
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
  const prior = previousMatch?.identity ?? {};
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

function findPreviousMatch(observed, transport, indices) {
  if (observed.mac && indices.byMac.has(observed.mac)) return indices.byMac.get(observed.mac);
  if (transport.usbInstance && indices.byUsbInstance.has(transport.usbInstance)) return indices.byUsbInstance.get(transport.usbInstance);
  if (observed.serialNumber && indices.bySerial.has(observed.serialNumber)) return indices.bySerial.get(observed.serialNumber);
  return null;
}

function matchUnit(unit) {
  const { description, name } = unit.transport;
  const { mac, firmwareSignature, rawSignatureLine } = unit.observed;

  if ((description ?? "").includes("STLink") || (name ?? "").includes("STLink")) {
    return {
      status: "matched",
      boardId: "p_nucleo_usb001_f072rb_v1",
      reason: "STLink virtual COM port matches the attached P-NUCLEO-USB001 / Nucleo-F072RB"
    };
  }

  if (firmwareSignature === "board_manager_cores3_gnss_demo") {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Current firmware signature matches the CoreS3 GNSS demo"
    };
  }

  if (firmwareSignature === "board_manager_dial_smoketest" || firmwareSignature === "m5_factory_stamp_ring_test") {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Current firmware signature matches a Dial smoke test or factory test image"
    };
  }

  if ((rawSignatureLine ?? "").includes("dial smoke test")) {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Boot banner identifies the board as the Dial smoke test image"
    };
  }

  if ((rawSignatureLine ?? "").includes("CoreS3 GNSS")) {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Boot banner identifies the board as the CoreS3 GNSS bring-up image"
    };
  }

  if (mac === "48:27:e2:66:b0:04") {
    return {
      status: "matched",
      boardId: "m5stack_cores3_gnss_v1",
      reason: "Observed MAC matches the previously fingerprinted CoreS3 GNSS bench unit"
    };
  }

  if (mac === "c0:4e:30:12:b3:e0") {
    return {
      status: "matched",
      boardId: "m5stack_dial_v1_1",
      reason: "Observed MAC matches the previously fingerprinted second Dial unit"
    };
  }

  return {
    status: "unmatched",
    boardId: null,
    reason: "No current heuristic matched this unit to a known board definition"
  };
}

async function observePort(portInfo, previousIndices) {
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
  };

  if ((vidPid.vid === "303A" && vidPid.pid === "1001") || (transport.name ?? "").includes("USB Serial Device")) {
    const toolOutput = await runEspTool(transport.port);
    observed.mac = parseMac(toolOutput) ?? observed.mac;
    observed.chip = parseChip(toolOutput);
    const signature = await captureSignature(transport.port);
    observed.firmwareSignature = signature.firmwareSignature;
    observed.rawSignatureLine = signature.rawSignatureLine;
  }

  const previousMatch = findPreviousMatch(observed, transport, previousIndices);
  const identity = mergeIdentity(observed, transport, previousMatch);

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
    },
    match: { status: "unknown", boardId: null, reason: null }
  };

  unit.match = matchUnit(unit);
  return unit;
}

async function main() {
  const ports = await readPorts();
  const previousUnits = await loadPreviousInventory();
  const previousIndices = buildPreviousIdentityIndex(previousUnits);
  const units = [];

  for (const portInfo of ports) {
    units.push(await observePort(portInfo, previousIndices));
  }

  units.sort((left, right) => String(left.transport.port).localeCompare(String(right.transport.port)));

  const payload = {
    generatedAt: new Date().toISOString(),
    host: {
      platform: "windows",
      hostname: os.hostname(),
    },
    units,
  };

  await mkdir(path.dirname(inventoryPath), { recursive: true });
  await writeFile(inventoryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Discovered ${units.length} units.`);
  for (const unit of units) {
    console.log(`${unit.transport.port}: ${unit.match.boardId ?? "unmatched"} [${unit.identity.stableKey}] (${unit.match.reason})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
