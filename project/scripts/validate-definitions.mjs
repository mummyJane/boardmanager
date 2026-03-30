import { access, readdir, readFile } from "node:fs/promises";
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

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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

function validateProjectDeployment(file, project, errors) {
  const deployment = project.deployment ?? null;
  if (!deployment) {
    errors.push(`${file}: project '${project.projectId}' missing deployment metadata`);
    return;
  }

  const transports = Array.isArray(deployment.transports) ? deployment.transports : [];
  if (transports.length === 0) {
    errors.push(`${file}: project '${project.projectId}' must declare at least one deployment transport`);
  }

  const transportSet = new Set();
  for (const transport of transports) {
    if (transportSet.has(transport)) {
      errors.push(`${file}: project '${project.projectId}' has duplicate deployment transport '${transport}'`);
    }
    transportSet.add(transport);
  }

  const ota = deployment.ota ?? {};
  const security = deployment.security ?? {};
  const otaSupported = ota.supported === true;
  const otaSigning = ota.signing ?? "none";
  const otaSignedBy = ota.signedBy ?? "none";
  const otaEncryption = ota.encryption ?? "none";
  const classification = security.classification ?? "standard";

  if (otaSupported && !transportSet.has("ota")) {
    errors.push(`${file}: project '${project.projectId}' enables OTA but does not include 'ota' in deployment.transports`);
  }

  if (!otaSupported && (otaSigning !== "none" || otaSignedBy !== "none" || otaEncryption !== "none")) {
    errors.push(`${file}: project '${project.projectId}' declares OTA signing or encryption while OTA is disabled`);
  }

  if (otaSupported && otaSigning !== "per-unit") {
    errors.push(`${file}: project '${project.projectId}' OTA updates must use per-unit signing`);
  }

  if (otaSupported && otaSignedBy !== "root") {
    errors.push(`${file}: project '${project.projectId}' OTA updates must be signed by the local root key`);
  }

  if (classification === "secure" && otaEncryption === "none") {
    errors.push(`${file}: secure project '${project.projectId}' must require OTA encryption`);
  }

  if (otaEncryption !== "none" && classification !== "secure") {
    errors.push(`${file}: project '${project.projectId}' enables OTA encryption but is not marked as a secure project`);
  }

  if (otaEncryption !== "none" && otaSigning === "none") {
    errors.push(`${file}: project '${project.projectId}' cannot enable OTA encryption without OTA signing`);
  }
}

async function validateProject(file, project, boardCatalog, partCatalog, errors) {
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

  if (!project.app?.appId) {
    errors.push(`${file}: project '${project.projectId}' missing app.appId`);
  }
  if (!project.app?.appRoot) {
    errors.push(`${file}: project '${project.projectId}' missing app.appRoot`);
  }
  if (!project.app?.userCodeRoot) {
    errors.push(`${file}: project '${project.projectId}' missing app.userCodeRoot`);
  }
  if (!project.app?.stableApi) {
    errors.push(`${file}: project '${project.projectId}' missing app.stableApi`);
  }
  if (!project.firmwareTarget?.family) {
    errors.push(`${file}: project '${project.projectId}' missing firmwareTarget.family`);
  }
  if (!project.firmwareTarget?.entryPoint) {
    errors.push(`${file}: project '${project.projectId}' missing firmwareTarget.entryPoint`);
  }

  if (project.app?.appRoot) {
    const appRootPath = path.join(projectRoot, project.app.appRoot);
    if (!await pathExists(appRootPath)) {
      errors.push(`${file}: project '${project.projectId}' app.appRoot '${project.app.appRoot}' does not exist`);
    }
  }

  if (project.app?.userCodeRoot) {
    const userCodeRootPath = path.join(projectRoot, project.app.userCodeRoot);
    if (!await pathExists(userCodeRootPath)) {
      errors.push(`${file}: project '${project.projectId}' app.userCodeRoot '${project.app.userCodeRoot}' does not exist`);
    } else {
      const userSourcePath = path.join(userCodeRootPath, "board_app_user.c");
      const userHeaderPath = path.join(userCodeRootPath, "board_app_user.h");
      if (!await pathExists(userSourcePath)) {
        errors.push(`${file}: project '${project.projectId}' reserved user source 'board_app_user.c' is missing from '${project.app.userCodeRoot}'`);
      }
      if (!await pathExists(userHeaderPath)) {
        errors.push(`${file}: project '${project.projectId}' reserved user header 'board_app_user.h' is missing from '${project.app.userCodeRoot}'`);
      }
    }
  }

  if (project.app?.stableApi) {
    const stableApiPath = path.join(projectRoot, project.app.stableApi);
    if (!await pathExists(stableApiPath)) {
      errors.push(`${file}: project '${project.projectId}' app.stableApi '${project.app.stableApi}' does not exist`);
    }
  }

  if (project.app?.appRoot && project.firmwareTarget?.entryPoint) {
    const entryPointPath = path.join(projectRoot, project.app.appRoot, project.firmwareTarget.entryPoint);
    if (!await pathExists(entryPointPath)) {
      errors.push(`${file}: project '${project.projectId}' firmware entryPoint '${project.firmwareTarget.entryPoint}' does not exist under '${project.app.appRoot}'`);
    }
  }

  validateProjectDeployment(file, project, errors);

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
  const projectCatalog = new Map();
  const appIds = new Map();
  for (const file of projectFiles) {
    const project = await loadJson(file);
    if (project.projectId) {
      if (projectCatalog.has(project.projectId)) {
        errors.push(`${file}: duplicate projectId '${project.projectId}'`);
      } else {
        projectCatalog.set(project.projectId, file);
      }
    }
    if (project.app?.appId) {
      if (appIds.has(project.app.appId)) {
        errors.push(`${file}: duplicate app.appId '${project.app.appId}' also used by ${appIds.get(project.app.appId)}`);
      } else {
        appIds.set(project.app.appId, file);
      }
    }
    await validateProject(file, project, boardCatalog, partCatalog, errors);
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

