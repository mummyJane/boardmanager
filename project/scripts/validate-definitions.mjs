import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const boardsDir = path.join(projectRoot, "boards");
const partsDir = path.join(projectRoot, "parts");
const projectsDir = path.join(projectRoot, "projects");

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadJsonFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await loadJsonFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function loadPartsCatalog(rootDir) {
  const files = await loadJsonFiles(rootDir);
  const catalog = new Map();
  const errors = [];

  for (const file of files) {
    const part = await loadJson(file);
    if (!part.partId) {
      errors.push(`${file}: missing partId`);
      continue;
    }

    if (catalog.has(part.partId)) {
      errors.push(`${file}: duplicate partId '${part.partId}'`);
      continue;
    }

    catalog.set(part.partId, { file, data: part });
  }

  return { catalog, errors };
}

function inferPlatformFromFamily(family) {
  const normalized = String(family ?? "").toUpperCase();
  if (normalized.includes("ESP32")) return "esp-idf";
  if (normalized.includes("STM32")) return "stm32cube";
  return "generic";
}

function validatePart(file, part, partCatalog, errors) {
  if (!part.partType) {
    errors.push(`${file}: part '${part.partId}' missing partType`);
  }

  if (!part.displayName) {
    errors.push(`${file}: part '${part.partId}' missing displayName`);
  }

  if (part.partType === "package") {
    if (!part.mcuId) {
      errors.push(`${file}: package '${part.partId}' missing mcuId`);
    } else if (!partCatalog.has(part.mcuId)) {
      errors.push(`${file}: package '${part.partId}' references unknown mcuId '${part.mcuId}'`);
    }
  }

  if (part.partType === "module") {
    if (!part.packageId || !partCatalog.has(part.packageId)) {
      errors.push(`${file}: module '${part.partId}' references unknown packageId '${part.packageId ?? ""}'`);
    }
    if (!part.mcuId || !partCatalog.has(part.mcuId)) {
      errors.push(`${file}: module '${part.partId}' references unknown mcuId '${part.mcuId ?? ""}'`);
    }
  }
}

function validateLegacySignal(file, boardId, signal, index, errors) {
  if (!signal.name) errors.push(`${file}: legacy board '${boardId}' signal[${index}] missing name`);
  if (!["digital_input", "digital_output"].includes(signal.kind)) errors.push(`${file}: legacy board '${boardId}' signal '${signal.name ?? index}' has unsupported kind '${signal.kind}'`);
  if (!["high", "low"].includes(signal.activeLevel)) errors.push(`${file}: legacy board '${boardId}' signal '${signal.name ?? index}' has invalid activeLevel '${signal.activeLevel}'`);
  if (!signal.mcuSignal) errors.push(`${file}: legacy board '${boardId}' signal '${signal.name ?? index}' missing mcuSignal`);
  if (!signal.mcuPin) errors.push(`${file}: legacy board '${boardId}' signal '${signal.name ?? index}' missing mcuPin`);
}

function validateBoard(file, board, partCatalog, errors) {
  if (!board.boardId) {
    errors.push(`${file}: missing boardId`);
    return;
  }

  if (!board.displayName) errors.push(`${file}: board '${board.boardId}' missing displayName`);
  if (!board.revision) errors.push(`${file}: board '${board.boardId}' missing revision`);

  const signalList = board.signals ?? board.io ?? [];
  const signalNames = new Set();
  const outputSignals = new Set();

  for (const [index, signal] of signalList.entries()) {
    if (!signal.name) {
      errors.push(`${file}: board '${board.boardId}' signal[${index}] missing name`);
      continue;
    }

    if (signalNames.has(signal.name)) {
      errors.push(`${file}: board '${board.boardId}' has duplicate signal '${signal.name}'`);
    }
    signalNames.add(signal.name);

    if (!["digital_input", "digital_output"].includes(signal.kind)) {
      errors.push(`${file}: board '${board.boardId}' signal '${signal.name}' has unsupported kind '${signal.kind}'`);
    }
    if (!["high", "low"].includes(signal.activeLevel)) {
      errors.push(`${file}: board '${board.boardId}' signal '${signal.name}' has invalid activeLevel '${signal.activeLevel}'`);
    }
    if (signal.kind === "digital_output") outputSignals.add(signal.name);

    if (board.controller?.moduleId) {
      if (!partCatalog.has(board.controller.moduleId)) {
        errors.push(`${file}: board '${board.boardId}' references unknown moduleId '${board.controller.moduleId}'`);
      }
      if (!signal.controllerSignal) {
        errors.push(`${file}: board '${board.boardId}' signal '${signal.name}' missing controllerSignal`);
      }
    } else {
      validateLegacySignal(file, board.boardId, signal, index, errors);
    }
  }

  if (!board.controller?.moduleId && !board.mcu) {
    errors.push(`${file}: board '${board.boardId}' must define either controller.moduleId or legacy mcu metadata`);
  }

  const busNames = new Set();
  const deviceIds = new Set();
  const deviceMap = new Map();

  for (const bus of board.buses ?? []) {
    if (!bus.name) {
      errors.push(`${file}: board '${board.boardId}' has bus without name`);
      continue;
    }
    if (busNames.has(bus.name)) {
      errors.push(`${file}: board '${board.boardId}' has duplicate bus '${bus.name}'`);
    }
    busNames.add(bus.name);

    if (!bus.kind) errors.push(`${file}: board '${board.boardId}' bus '${bus.name}' missing kind`);
    if (!bus.controllerPeripheral) errors.push(`${file}: board '${board.boardId}' bus '${bus.name}' missing controllerPeripheral`);

    for (const device of bus.devices ?? []) {
      if (!device.instanceId) {
        errors.push(`${file}: board '${board.boardId}' bus '${bus.name}' has device without instanceId`);
        continue;
      }
      if (deviceIds.has(device.instanceId)) {
        errors.push(`${file}: board '${board.boardId}' has duplicate device instanceId '${device.instanceId}'`);
      }
      deviceIds.add(device.instanceId);
      deviceMap.set(device.instanceId, device);

      if (!device.partId || !partCatalog.has(device.partId)) {
        errors.push(`${file}: board '${board.boardId}' device '${device.instanceId}' references unknown partId '${device.partId ?? ""}'`);
      }

      for (const [key, value] of Object.entries(device.config ?? {})) {
        if (key.endsWith("Signal") && !signalNames.has(value)) {
          errors.push(`${file}: board '${board.boardId}' device '${device.instanceId}' config '${key}' references unknown signal '${value}'`);
        }
      }
    }
  }

  for (const step of board.bootSequence ?? []) {
    if (!step.kind) {
      errors.push(`${file}: board '${board.boardId}' boot step missing kind`);
      continue;
    }

    if (step.kind === "bus" && !busNames.has(step.bus)) {
      errors.push(`${file}: board '${board.boardId}' boot step references unknown bus '${step.bus}'`);
    }
    if (step.kind === "device" && !deviceMap.has(step.instanceId)) {
      errors.push(`${file}: board '${board.boardId}' boot step references unknown device '${step.instanceId}'`);
    }
    if (step.kind === "signal") {
      if (!signalNames.has(step.signal)) {
        errors.push(`${file}: board '${board.boardId}' boot step references unknown signal '${step.signal}'`);
      } else if (!outputSignals.has(step.signal)) {
        errors.push(`${file}: board '${board.boardId}' boot step signal '${step.signal}' is not a digital_output`);
      }
    }
  }

  if (board.mcu?.family && !board.mcu.sdk) {
    inferPlatformFromFamily(board.mcu.family);
  }
}

function validateProject(file, project, boardCatalog, partCatalog, errors) {
  if (!project.projectId) errors.push(`${file}: missing projectId`);
  if (!project.boardId) {
    errors.push(`${file}: project '${project.projectId ?? "unknown"}' missing boardId`);
    return;
  }
  const board = boardCatalog.get(project.boardId);
  if (!board) {
    errors.push(`${file}: project '${project.projectId ?? "unknown"}' references unknown boardId '${project.boardId}'`);
    return;
  }

  const boardData = board.data;
  const signalNames = new Set((boardData.signals ?? boardData.io ?? []).map((signal) => signal.name));
  const deviceInstances = new Map();
  for (const bus of boardData.buses ?? []) {
    for (const device of bus.devices ?? []) {
      deviceInstances.set(device.instanceId, device.partId);
    }
  }

  for (const [instanceId, override] of Object.entries(project.partOverrides ?? {})) {
    if (!deviceInstances.has(instanceId)) {
      errors.push(`${file}: project '${project.projectId}' partOverride '${instanceId}' does not exist on board '${project.boardId}'`);
      continue;
    }
    if (override.partId && !partCatalog.has(override.partId)) {
      errors.push(`${file}: project '${project.projectId}' partOverride '${instanceId}' references unknown partId '${override.partId}'`);
    }
  }

  for (const signalName of Object.keys(project.signalOverrides ?? {})) {
    if (!signalNames.has(signalName)) {
      errors.push(`${file}: project '${project.projectId}' signalOverride '${signalName}' does not exist on board '${project.boardId}'`);
    }
  }
}

async function main() {
  const { catalog: partCatalog, errors } = await loadPartsCatalog(partsDir);

  for (const { file, data } of partCatalog.values()) {
    validatePart(file, data, partCatalog, errors);
  }

  const boardFiles = await loadJsonFiles(boardsDir);
  const boardCatalog = new Map();
  for (const file of boardFiles) {
    const board = await loadJson(file);
    if (board.boardId && !boardCatalog.has(board.boardId)) {
      boardCatalog.set(board.boardId, { file, data: board });
    }
    validateBoard(file, board, partCatalog, errors);
  }

  const projectFiles = await loadJsonFiles(projectsDir);
  for (const file of projectFiles) {
    const project = await loadJson(file);
    validateProject(file, project, boardCatalog, partCatalog, errors);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Validation error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${partCatalog.size} parts, ${boardCatalog.size} boards, and ${projectFiles.length} projects.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
