import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const boardsRoot = path.join(projectRoot, "boards");
const partsRoot = path.join(projectRoot, "parts");
const contractsRoot = path.join(projectRoot, "job-manager", "contracts");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadDirectoryJson(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(rootDir, entry.name);
    items.push(await readJson(filePath));
  }
  return items;
}

async function loadParts() {
  const categories = ["mcu", "packages", "modules", "devices"];
  const map = new Map();
  for (const category of categories) {
    const items = await loadDirectoryJson(path.join(partsRoot, category));
    for (const item of items) {
      map.set(item.partId, item);
    }
  }
  return map;
}

function makeCheck(checkId, kind, description, source, extra = {}) {
  return {
    checkId,
    kind,
    description,
    source,
    passCriteria: extra.passCriteria ?? null,
    failureNotes: extra.failureNotes ?? [],
    config: extra.config ?? {},
  };
}

function generateControllerStage(board, modulePart, mcuPart) {
  const controllerTarget = board.controller?.moduleId ?? null;
  const controllerPeripheralChecks = [];
  const peripherals = mcuPart?.peripherals ?? {};
  for (const [family, values] of Object.entries(peripherals)) {
    if (!Array.isArray(values) || values.length === 0) continue;
    controllerPeripheralChecks.push(makeCheck(
      `controller_peripheral_${family}`,
      "controller-peripheral-declared",
      `Confirm the controller exposes the declared ${family.toUpperCase()} capability needed by the board config.`,
      "mcu.peripherals",
      {
        config: { family, declared: values },
      }
    ));
  }

  return {
    phaseId: "controller",
    order: 1,
    level: "controller",
    target: controllerTarget,
    dependsOn: [],
    notes: modulePart?.notes ?? [],
    checks: [
      makeCheck(
        "controller_identity",
        "controller-identity",
        "Confirm the connected unit reports or probes as the configured controller module and MCU family.",
        "board.controller",
        {
          passCriteria: "The matched unit identity agrees with the configured module or MCU family.",
          config: {
            moduleId: modulePart?.partId ?? controllerTarget,
            moduleName: modulePart?.displayName ?? null,
            mcuId: mcuPart?.partId ?? null,
            mcuName: mcuPart?.displayName ?? null,
            sdk: mcuPart?.sdk ?? null,
          },
        }
      ),
      makeCheck(
        "controller_transport",
        "transport-ready",
        "Confirm the controller transport required for validation is present and usable.",
        "discovery.transport",
        {
          passCriteria: "A transport such as serial, USB-serial/JTAG, or STLink VCP is available for the selected unit.",
        }
      ),
      ...controllerPeripheralChecks,
    ],
  };
}

function generateBusStage(bus, order, deviceMap) {
  const dependencyIds = ["controller"];
  const config = {
    bus: bus.name,
    kind: bus.kind,
    controllerPeripheral: bus.controllerPeripheral ?? null,
    lines: bus.lines ?? {},
    expectedDevices: (bus.devices ?? []).map((device) => ({
      instanceId: device.instanceId,
      partId: device.partId,
      i2cAddress: device.config?.i2cAddress ?? null,
    })),
  };

  const checks = [
    makeCheck(
      `${bus.name}_configured`,
      "bus-configured",
      `Confirm bus ${bus.name} is configured on the declared controller peripheral and signal lines.`,
      "board.buses",
      {
        passCriteria: "The bus can be opened using the declared controller peripheral and line mapping.",
        config,
      }
    ),
  ];

  if (bus.kind === "i2c") {
    const configuredAddresses = (bus.devices ?? [])
      .map((device) => device.config?.i2cAddress)
      .filter(Boolean);

    checks.push(
      makeCheck(
        `${bus.name}_scan`,
        "i2c-scan",
        `Scan the ${bus.name} bus and compare observed addresses against the board config.`,
        "board.buses.devices.config.i2cAddress",
        {
          passCriteria: "All configured addresses are observed or any missing and unexpected addresses are reported explicitly.",
          failureNotes: [
            "Missing configured addresses indicate that a declared device is absent, unpowered, or misconfigured.",
            "Unexpected addresses should be reported as observed-but-undeclared devices, not silently ignored.",
          ],
          config: {
            bus: bus.name,
            configuredAddresses,
          },
        }
      )
    );
  }

  if (bus.kind === "spi") {
    checks.push(
      makeCheck(
        `${bus.name}_command_path`,
        "spi-command-path",
        `Confirm the ${bus.name} command path is usable before dependent device checks run.`,
        "board.buses",
        {
          passCriteria: "The SPI bus can drive chip-select and data lines for dependent devices.",
          config,
        }
      )
    );
  }

  return {
    phaseId: `bus:${bus.name}`,
    order,
    level: "bus",
    target: bus.name,
    dependsOn: dependencyIds,
    notes: (bus.devices ?? []).map((device) => {
      const part = deviceMap.get(device.partId);
      return `${device.instanceId}: ${part?.displayName ?? device.partId}`;
    }),
    checks,
  };
}

function generateSignalStage(step, signal, order) {
  return {
    phaseId: `signal:${signal.name}`,
    order,
    level: "signal",
    target: signal.name,
    dependsOn: ["controller"],
    notes: [],
    checks: [
      makeCheck(
        `${signal.name}_access`,
        signal.kind === "digital_output" ? "signal-drive" : "signal-read",
        signal.kind === "digital_output"
          ? `Confirm signal ${signal.name} can be driven to the configured state for board bring-up.`
          : `Confirm signal ${signal.name} can be sampled through the board API.`,
        "board.signals",
        {
          passCriteria: signal.kind === "digital_output"
            ? "The signal can be driven to the requested board-level state."
            : "The signal can be sampled without transport or API errors.",
          config: {
            signal: signal.name,
            controllerSignal: signal.controllerSignal ?? null,
            activeLevel: signal.activeLevel ?? null,
            requestedState: step.state ?? null,
          },
        }
      ),
    ],
  };
}

function findBusForInstance(board, instanceId) {
  for (const bus of board.buses ?? []) {
    for (const device of bus.devices ?? []) {
      if (device.instanceId === instanceId) {
        return bus;
      }
    }
  }
  return null;
}

function findDeviceConfig(board, instanceId) {
  const bus = findBusForInstance(board, instanceId);
  if (!bus) return null;
  const device = (bus.devices ?? []).find((entry) => entry.instanceId === instanceId);
  return device ? { bus, device } : null;
}

function generateDeviceStage(board, step, order, deviceMap) {
  const found = findDeviceConfig(board, step.instanceId);
  if (!found) {
    return {
      phaseId: `device:${step.instanceId}`,
      order,
      level: "device",
      target: step.instanceId,
      dependsOn: ["controller"],
      notes: ["Device instance was referenced in bootSequence but no matching bus device config was found."],
      checks: [],
    };
  }

  const { bus, device } = found;
  const part = deviceMap.get(device.partId);
  const smokeTest = part?.smokeTest ?? {};
  const checks = [
    makeCheck(
      `${step.instanceId}_presence`,
      "device-presence",
      `Confirm device ${step.instanceId} is reachable through its declared ${bus.kind.toUpperCase()} path.`,
      "board.buses.devices",
      {
        passCriteria: smokeTest.passCriteria ?? "The device is reachable through the declared bus path.",
        failureNotes: smokeTest.failureNotes ?? [],
        config: {
          instanceId: step.instanceId,
          partId: device.partId,
          bus: bus.name,
          busKind: bus.kind,
          deviceConfig: device.config ?? {},
        },
      }
    ),
    ...(Array.isArray(smokeTest.checks) ? smokeTest.checks.map((text, index) => makeCheck(
      `${step.instanceId}_smoke_${index + 1}`,
      "device-smoke-check",
      text,
      "part.smokeTest",
      {
        passCriteria: smokeTest.passCriteria ?? null,
        failureNotes: smokeTest.failureNotes ?? [],
        config: {
          instanceId: step.instanceId,
          partId: device.partId,
          bus: bus.name,
          deviceConfig: device.config ?? {},
        },
      }
    )) : []),
  ];

  return {
    phaseId: `device:${step.instanceId}`,
    order,
    level: "device",
    target: step.instanceId,
    dependsOn: [`bus:${bus.name}`],
    notes: part?.initContract?.preconditions ?? [],
    checks,
  };
}

async function loadBoards() {
  return loadDirectoryJson(boardsRoot);
}

function generateBoardContract(board, parts) {
  const modulePart = parts.get(board.controller?.moduleId);
  const mcuPart = parts.get(modulePart?.mcuId);
  const deviceMap = parts;

  const phases = [];
  phases.push(generateControllerStage(board, modulePart, mcuPart));

  const orderMap = new Map();
  let nextOrder = 2;

  for (const step of board.bootSequence ?? []) {
    if (step.kind === "module") {
      continue;
    }

    if (step.kind === "bus") {
      if (orderMap.has(`bus:${step.bus}`)) continue;
      const bus = (board.buses ?? []).find((entry) => entry.name === step.bus);
      if (!bus) continue;
      phases.push(generateBusStage(bus, nextOrder, deviceMap));
      orderMap.set(`bus:${step.bus}`, nextOrder);
      nextOrder += 1;
      continue;
    }

    if (step.kind === "signal") {
      const signal = (board.signals ?? []).find((entry) => entry.name === step.signal);
      if (!signal) continue;
      phases.push(generateSignalStage(step, signal, nextOrder));
      nextOrder += 1;
      continue;
    }

    if (step.kind === "device") {
      phases.push(generateDeviceStage(board, step, nextOrder, deviceMap));
      nextOrder += 1;
    }
  }

  return {
    contractId: `${board.boardId}.validation-contract`,
    boardId: board.boardId,
    displayName: board.displayName,
    revision: board.revision,
    platformSdk: mcuPart?.sdk ?? null,
    generatedAt: new Date().toISOString(),
    strategy: {
      order: ["controller", "bus", "signal", "device"],
      dependencySource: "board.bootSequence",
      notes: [
        "Controller checks run before dependent bus, signal, and device checks.",
        "Bus checks establish transport readiness before attached-device probes.",
        "Part smoke-test metadata is reused for device-level validation checks.",
      ],
    },
    phases,
  };
}

async function main() {
  await mkdir(contractsRoot, { recursive: true });
  const [boards, parts] = await Promise.all([loadBoards(), loadParts()]);

  for (const board of boards) {
    const contract = generateBoardContract(board, parts);
    const filePath = path.join(contractsRoot, `${board.boardId}.validation-contract.json`);
    await writeFile(filePath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  }

  console.log(`Generated validation contracts for ${boards.length} boards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
