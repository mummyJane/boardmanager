import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "..");
const partsModulesRoot = path.join(projectRoot, "parts", "modules");
const partsDevicesRoot = path.join(projectRoot, "parts", "devices");
const boardsRoot = path.join(projectRoot, "boards");
const projectsRoot = path.join(projectRoot, "projects");
const helpBoardsRoot = path.join(projectRoot, "help", "boards");
const helpPartsRoot = path.join(projectRoot, "help", "parts");
const outputPath = path.join(projectRoot, "web-ui", "data", "stage4-tree-model.json");

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadJsonFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(rootDir, entry.name))
    .sort();
}

function sortByTitle(nodes) {
  return nodes.sort((left, right) => left.title.localeCompare(right.title));
}

function makeDocChildren(docRefs) {
  const children = [];
  if (docRefs.datasheet) {
    children.push({
      nodeId: `${docRefs.nodeBase}:datasheet`,
      nodeKind: "help-reference",
      title: "Datasheet",
      sourcePath: null,
      metadata: { kind: "datasheet", href: docRefs.datasheet },
      children: []
    });
  }
  if (docRefs.website) {
    children.push({
      nodeId: `${docRefs.nodeBase}:website`,
      nodeKind: "help-reference",
      title: "Website",
      sourcePath: null,
      metadata: { kind: "website", href: docRefs.website },
      children: []
    });
  }
  if (docRefs.apiGuide) {
    children.push({
      nodeId: `${docRefs.nodeBase}:guide`,
      nodeKind: "help-reference",
      title: "API Guide",
      sourcePath: docRefs.apiGuide,
      metadata: { kind: "apiGuide", path: docRefs.apiGuide },
      children: []
    });
  }
  return children;
}

function normalizeCompositionChildren(part) {
  const composition = part.composition ?? null;
  if (!composition) {
    return [];
  }

  if (Array.isArray(composition.children)) {
    return composition.children;
  }

  const children = [];
  if (composition.gnssReceiverPartId) {
    children.push({
      partId: composition.gnssReceiverPartId,
      role: "gnssReceiver",
      displayName: composition.gnssReceiverPartId,
    });
  }
  if (composition.imu) {
    children.push({
      partId: composition.imu.toLowerCase(),
      role: "imu",
      displayName: composition.imu,
    });
  }
  if (composition.magnetometer) {
    children.push({
      partId: composition.magnetometer.toLowerCase(),
      role: "magnetometer",
      displayName: composition.magnetometer,
    });
  }
  if (composition.barometer) {
    children.push({
      partId: composition.barometer.toLowerCase(),
      role: "barometer",
      displayName: composition.barometer,
    });
  }
  return children;
}


async function buildModuleNodes() {
  const files = [
    ...(await loadJsonFiles(partsModulesRoot)),
    ...(await loadJsonFiles(partsDevicesRoot)),
  ].sort();

  const nodes = [];
  for (const file of files) {
    const part = await loadJson(file);
    const localGuide = part.docs?.apiGuide ? toRepoPath(path.join(repoRoot, part.docs.apiGuide)) : null;
    const implicitGuidePath = path.join(helpPartsRoot, `${part.partId}.md`);
    const helpGuide = localGuide ?? (await pathExists(implicitGuidePath) ? toRepoPath(implicitGuidePath) : null);
    const docChildren = makeDocChildren({
      nodeBase: `module:${part.partId}`,
      datasheet: part.docs?.datasheet ?? null,
      website: part.docs?.website ?? null,
      apiGuide: helpGuide,
    });

    const compositionChildren = normalizeCompositionChildren(part)
      .map((child, index) => ({
        nodeId: `module:${part.partId}:composition:${index}`,
        nodeKind: "module-reference",
        title: child.displayName ?? child.partId ?? child.moduleId ?? `child-${index}`,
        sourcePath: null,
        metadata: {
          role: child.role ?? null,
          partId: child.partId ?? null,
          moduleId: child.moduleId ?? child.partId ?? null,
          config: child.config ?? {}
        },
        children: []
      }));

    nodes.push({
      nodeId: `module:${part.partId}`,
      nodeKind: "module",
      title: part.displayName,
      sourcePath: toRepoPath(file),
      metadata: {
        moduleId: part.partId,
        partType: part.partType,
        catalogRole: part.partType === "module" ? "controller" : "device",
        vendor: part.vendor ?? null,
        interfaces: part.interfaces ?? [],
        packageId: part.packageId ?? null,
        mcuId: part.mcuId ?? null,
        defaultConfig: part.defaultConfig ?? {},
        supportsComposition: compositionChildren.length > 0,
        api: part.api ?? null,
        docs: {
          datasheet: part.docs?.datasheet ?? null,
          website: part.docs?.website ?? null,
          apiGuide: helpGuide,
        }
      },
      children: sortByTitle([...compositionChildren, ...docChildren])
    });
  }

  return sortByTitle(nodes);
}

function makeSignalNodes(board) {
  const signals = Array.isArray(board.signals) ? board.signals : [];
  return sortByTitle(signals.map((signal) => ({
    nodeId: `board:${board.boardId}:signal:${signal.name}`,
    nodeKind: "signal",
    title: signal.name,
    sourcePath: null,
    metadata: {
      kind: signal.kind ?? null,
      controllerSignal: signal.controllerSignal ?? signal.mcuSignal ?? null,
      logicalFunction: signal.logicalFunction ?? null,
      peripheral: signal.peripheral ?? null,
      activeLevel: signal.activeLevel ?? null,
    },
    children: []
  })));
}

function makeConnectorNodes(board) {
  const connectors = Array.isArray(board.connectors) ? board.connectors : [];
  return sortByTitle(connectors.map((connector) => ({
    nodeId: `board:${board.boardId}:connector:${connector.name}`,
    nodeKind: "connector",
    title: connector.name,
    sourcePath: null,
    metadata: {
      type: connector.type ?? null,
      pinCount: Array.isArray(connector.pins) ? connector.pins.length : 0,
    },
    children: (connector.pins ?? []).map((pin, index) => ({
      nodeId: `board:${board.boardId}:connector:${connector.name}:pin:${index}`,
      nodeKind: "connector-pin",
      title: pin.label ?? `pin-${index}`,
      sourcePath: null,
      metadata: {
        signal: pin.signal ?? null,
      },
      children: []
    }))
  })));
}

function makeBusNodes(board) {
  const buses = Array.isArray(board.buses) ? board.buses : [];
  return sortByTitle(buses.map((bus) => ({
    nodeId: `board:${board.boardId}:bus:${bus.name}`,
    nodeKind: "bus",
    title: bus.name,
    sourcePath: null,
    metadata: {
      kind: bus.kind ?? null,
      controllerPeripheral: bus.controllerPeripheral ?? null,
      lines: bus.lines ?? {},
    },
    children: sortByTitle((bus.devices ?? []).map((device) => ({
      nodeId: `board:${board.boardId}:device:${device.instanceId}`,
      nodeKind: "module-instance",
      title: device.instanceId,
      sourcePath: null,
      metadata: {
        instanceId: device.instanceId,
        moduleId: device.partId,
        busName: bus.name,
        config: device.config ?? {},
      },
      children: []
    })))
  })));
}

async function buildBoardNodes(projectIndex) {
  const files = await loadJsonFiles(boardsRoot);
  const nodes = [];

  for (const file of files) {
    const board = await loadJson(file);
    const helpPath = path.join(helpBoardsRoot, `${board.boardId}.md`);
    const helpGuide = await pathExists(helpPath) ? toRepoPath(helpPath) : null;
    const children = [];

    if (board.controller?.moduleId) {
      children.push({
        nodeId: `board:${board.boardId}:controller`,
        nodeKind: "module-instance",
        title: "controller",
        sourcePath: null,
        metadata: {
          instanceId: "controller",
          moduleId: board.controller.moduleId,
          role: "controller"
        },
        children: []
      });
    }

    children.push(...makeBusNodes(board));
    children.push(...makeSignalNodes(board));
    children.push(...makeConnectorNodes(board));

    const docChildren = makeDocChildren({
      nodeBase: `board:${board.boardId}`,
      datasheet: null,
      website: board.sources?.[0] ?? null,
      apiGuide: helpGuide,
    });
    children.push(...docChildren);

    nodes.push({
      nodeId: `board:${board.boardId}`,
      nodeKind: "board",
      title: board.displayName,
      sourcePath: toRepoPath(file),
      metadata: {
        boardId: board.boardId,
        vendor: board.vendor ?? null,
        revision: board.revision ?? null,
        controllerModuleId: board.controller?.moduleId ?? null,
        capabilityKeys: Object.keys(board.capabilities ?? {}).filter((key) => board.capabilities[key] === true).sort(),
        projectIds: projectIndex.get(board.boardId) ?? [],
        helpGuide,
      },
      children: sortByTitle(children)
    });
  }

  return sortByTitle(nodes);
}

async function buildProjectNodes() {
  const files = await loadJsonFiles(projectsRoot);
  const nodes = [];
  const projectIndex = new Map();

  for (const file of files) {
    const project = await loadJson(file);
    const boardProjects = projectIndex.get(project.boardId) ?? [];
    boardProjects.push(project.projectId);
    boardProjects.sort();
    projectIndex.set(project.boardId, boardProjects);

    const children = [
      {
        nodeId: `project:${project.projectId}:board`,
        nodeKind: "board-reference",
        title: project.boardId,
        sourcePath: null,
        metadata: { boardId: project.boardId },
        children: []
      },
      {
        nodeId: `project:${project.projectId}:deployment`,
        nodeKind: "deployment",
        title: "deployment",
        sourcePath: null,
        metadata: {
          transports: project.deployment?.transports ?? [],
          ota: project.deployment?.ota ?? {},
          security: project.deployment?.security ?? {}
        },
        children: []
      }
    ];

    for (const [name, override] of Object.entries(project.partOverrides ?? {})) {
      children.push({
        nodeId: `project:${project.projectId}:part-override:${name}`,
        nodeKind: "part-override",
        title: name,
        sourcePath: null,
        metadata: {
          partId: override.partId ?? null,
          config: override.config ?? {}
        },
        children: []
      });
    }

    for (const [name, override] of Object.entries(project.signalOverrides ?? {})) {
      children.push({
        nodeId: `project:${project.projectId}:signal-override:${name}`,
        nodeKind: "signal-override",
        title: name,
        sourcePath: null,
        metadata: override,
        children: []
      });
    }

    nodes.push({
      nodeId: `project:${project.projectId}`,
      nodeKind: "project",
      title: project.displayName,
      sourcePath: toRepoPath(file),
      metadata: {
        projectId: project.projectId,
        boardId: project.boardId,
        firmwareFamily: project.firmwareTarget?.family ?? null,
        entryPoint: project.firmwareTarget?.entryPoint ?? null,
        appId: project.app?.appId ?? null,
        appRoot: project.app?.appRoot ?? null,
        userCodeRoot: project.app?.userCodeRoot ?? null,
        generatedSupportRoot: project.app?.generatedSupportRoot ?? null,
        stableApi: project.app?.stableApi ?? null,
      },
      children: sortByTitle(children)
    });
  }

  return { nodes: sortByTitle(nodes), projectIndex };
}

export async function buildStage4TreeModel() {
  const moduleNodes = await buildModuleNodes();
  const projectData = await buildProjectNodes();
  const boardNodes = await buildBoardNodes(projectData.projectIndex);

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    preferredWebRuntime: "python",
    summary: {
      moduleCount: moduleNodes.length,
      boardCount: boardNodes.length,
      projectCount: projectData.nodes.length,
    },
    roots: [
      {
        nodeId: "modules-root",
        nodeKind: "root",
        title: "Modules",
        sourcePath: null,
        metadata: { domain: "modules" },
        children: moduleNodes,
      },
      {
        nodeId: "boards-root",
        nodeKind: "root",
        title: "Boards",
        sourcePath: null,
        metadata: { domain: "boards" },
        children: boardNodes,
      },
      {
        nodeId: "projects-root",
        nodeKind: "root",
        title: "Projects",
        sourcePath: null,
        metadata: { domain: "projects" },
        children: projectData.nodes,
      }
    ]
  };
}

async function main() {
  const model = await buildStage4TreeModel();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  console.log(`Generated Stage 4 tree model: ${toRepoPath(outputPath)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});