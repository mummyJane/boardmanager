import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const boardsDir = path.join(projectRoot, "boards");
const partsDir = path.join(projectRoot, "parts");
const generatedDir = path.join(projectRoot, "generated");

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}

function upperName(value) {
  return sanitizeName(value).toUpperCase();
}

function cString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function mapKind(kind) {
  if (kind === "digital_input") {
    return "BOARD_IO_DIGITAL_INPUT";
  }

  if (kind === "digital_output") {
    return "BOARD_IO_DIGITAL_OUTPUT";
  }

  throw new Error(`Unsupported io kind: ${kind}`);
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadPartsCatalog(rootDir) {
  const catalog = new Map();

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".json")) {
        continue;
      }

      const part = await loadJson(fullPath);
      if (part.partId) {
        catalog.set(part.partId, part);
      }
    }
  }

  await walk(rootDir);
  return catalog;
}

function inferPlatformFromFamily(family) {
  const normalized = String(family ?? "").toUpperCase();

  if (normalized.includes("ESP32")) {
    return "esp-idf";
  }

  if (normalized.includes("STM32")) {
    return "stm32cube";
  }

  return "generic";
}

function resolveController(board, parts) {
  if (!board.controller?.moduleId) {
    if (!board.mcu) {
      throw new Error(`Board ${board.boardId} has neither controller.moduleId nor legacy mcu metadata`);
    }

    return {
      module: null,
      packageDef: null,
      mcu: {
        displayName: board.mcu.family,
        partId: sanitizeName(board.mcu.family.toLowerCase()),
        sdk: board.mcu.sdk ?? inferPlatformFromFamily(board.mcu.family),
      },
      partNumber: board.mcu.partNumber,
      platformSdk: board.mcu.sdk ?? inferPlatformFromFamily(board.mcu.family),
      resolvePin(signalName) {
        return board.io?.find((item) => item.mcuSignal === signalName)?.mcuPin ?? signalName;
      },
    };
  }

  const moduleDef = parts.get(board.controller.moduleId);
  if (!moduleDef) {
    throw new Error(`Board ${board.boardId} references unknown module ${board.controller.moduleId}`);
  }

  const packageDef = moduleDef.packageId ? parts.get(moduleDef.packageId) : null;
  const mcuDef = moduleDef.mcuId ? parts.get(moduleDef.mcuId) : packageDef?.mcuId ? parts.get(packageDef.mcuId) : null;

  if (!mcuDef) {
    throw new Error(`Module ${moduleDef.partId} does not resolve to an MCU definition`);
  }

  return {
    module: moduleDef,
    packageDef,
    mcu: mcuDef,
    partNumber: packageDef?.displayName ?? moduleDef.displayName,
    platformSdk: mcuDef.sdk ?? inferPlatformFromFamily(mcuDef.displayName),
    resolvePin(signalName) {
      return packageDef?.pins?.[signalName] ?? signalName;
    },
  };
}

function resolveSignals(board, controller) {
  const sourceSignals = board.signals ?? board.io ?? [];

  return sourceSignals.map((signal) => ({
    name: signal.name,
    kind: signal.kind,
    logicalFunction: signal.logicalFunction,
    mcuSignal: signal.controllerSignal ?? signal.mcuSignal,
    mcuPin: signal.mcuPin ?? controller.resolvePin(signal.controllerSignal ?? signal.mcuSignal),
    peripheral: signal.peripheral ?? null,
    activeLevel: signal.activeLevel,
  }));
}

function buildBusIndex(board) {
  const map = new Map();
  for (const bus of board.buses ?? []) {
    map.set(bus.name, bus);
  }
  return map;
}

function buildDeviceIndex(board, parts) {
  const map = new Map();

  for (const bus of board.buses ?? []) {
    for (const device of bus.devices ?? []) {
      map.set(device.instanceId, {
        ...device,
        busName: bus.name,
        busKind: bus.kind,
        controllerPeripheral: bus.controllerPeripheral,
        part: parts.get(device.partId) ?? null,
      });
    }
  }

  return map;
}

function generateHeader(board, resolvedSignals) {
  const guard = `${upperName(board.boardId)}_H`;
  const lines = [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    '#include "board_api.h"',
    "",
    `extern const board_descriptor_t ${board.boardId}_descriptor;`,
    "",
    `void ${board.boardId}_init(void);`
  ];

  for (const signal of resolvedSignals) {
    if (signal.kind === "digital_output") {
      lines.push(`void ${board.boardId}_${signal.name}_set(bool enabled);`);
    } else if (signal.kind === "digital_input") {
      lines.push(`bool ${board.boardId}_${signal.name}_read(void);`);
    }
  }

  lines.push("", `#endif`);
  return `${lines.join("\n")}\n`;
}

function emitBootHookPrototype(boardId, stepName) {
  return `void ${boardId}_platform_boot_${sanitizeName(stepName)}(void);`;
}

function emitSignalHookPrototype(boardId, signal) {
  if (signal.kind === "digital_output") {
    return `void ${boardId}_platform_${signal.name}_set(bool enabled);`;
  }

  return `bool ${boardId}_platform_${signal.name}_read(void);`;
}

function generateBootSequence(board, controller, resolvedSignals, busIndex, deviceIndex) {
  const hookPrototypes = [];
  const helperLines = [];
  const initLines = [];
  const outputSignals = new Set(resolvedSignals.filter((signal) => signal.kind === "digital_output").map((signal) => signal.name));
  const platformSdk = controller.platformSdk;

  for (const step of board.bootSequence ?? []) {
    const stepName = sanitizeName(step.name ?? step.kind);
    const hookName = `${board.boardId}_platform_boot_${stepName}`;

    if (["module", "bus", "device"].includes(step.kind)) {
      hookPrototypes.push(emitBootHookPrototype(board.boardId, step.name ?? step.kind));
      helperLines.push(`static void ${board.boardId}_boot_${stepName}(void)`, "{", `    ${hookName}();`, "}", "");
      initLines.push(`    ${board.boardId}_boot_${stepName}();`);
      continue;
    }

    if (step.kind === "signal") {
      if (outputSignals.has(step.signal)) {
        initLines.push(`    ${board.boardId}_${step.signal}_set(${step.state ? "true" : "false"});`);
      } else {
        initLines.push(`    /* Invalid boot signal reference retained for visibility: ${step.signal}. */`);
      }
    }
  }

  for (const signal of resolvedSignals) {
    hookPrototypes.push(emitSignalHookPrototype(board.boardId, signal));
  }

  return {
    hookPrototypes,
    helperLines,
    initLines,
    platformSdk,
  };
}

function generateSource(board, controller, resolvedSignals, busIndex, deviceIndex) {
  const arrayName = `${board.boardId}_io`;
  const boot = generateBootSequence(board, controller, resolvedSignals, busIndex, deviceIndex);
  const lines = [
    `#include "${board.boardId}.h"`,
    '#include <stddef.h>',
    ""
  ];

  for (const prototype of boot.hookPrototypes) {
    lines.push(prototype);
  }

  if (boot.hookPrototypes.length > 0) {
    lines.push("");
  }

  if (boot.helperLines.length > 0) {
    lines.push(...boot.helperLines);
  }

  lines.push(`static const board_io_descriptor_t ${arrayName}[] = {`);

  for (const signal of resolvedSignals) {
    lines.push(
      "    { " +
        [
          cString(signal.name),
          mapKind(signal.kind),
          cString(signal.logicalFunction),
          cString(signal.mcuSignal),
          cString(signal.mcuPin),
          cString(signal.peripheral),
          signal.activeLevel === "high" ? "true" : "false"
        ].join(", ") +
        " },"
    );
  }

  lines.push("};", "", `const board_descriptor_t ${board.boardId}_descriptor = {`);
  lines.push(`    ${cString(board.boardId)},`);
  lines.push(`    ${cString(board.displayName)},`);
  lines.push(`    ${cString(board.revision)},`);
  lines.push(`    ${cString(controller.mcu.displayName ?? board.mcu?.family)},`);
  lines.push(`    ${cString(controller.partNumber ?? board.mcu?.partNumber)},`);
  lines.push(`    ${cString(boot.platformSdk)},`);
  lines.push(`    ${resolvedSignals.length},`);
  lines.push(`    ${arrayName}`);
  lines.push("};", "", `void ${board.boardId}_init(void)`, "{");

  if (boot.initLines.length > 0) {
    lines.push(`    /* Boot sequence generated for ${boot.platformSdk}. */`);
    lines.push(...boot.initLines);
  } else {
    lines.push("    /* TODO: configure MCU pins and peripherals for this board. */");
  }

  lines.push("}");

  for (const signal of resolvedSignals) {
    lines.push("");

    if (signal.kind === "digital_output") {
      lines.push(`void ${board.boardId}_${signal.name}_set(bool enabled)`, "{", `    ${board.boardId}_platform_${signal.name}_set(enabled);`, "}");
    } else if (signal.kind === "digital_input") {
      lines.push(`bool ${board.boardId}_${signal.name}_read(void)`, "{", `    return ${board.boardId}_platform_${signal.name}_read();`, "}");
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(generatedDir, { recursive: true });
  const parts = await loadPartsCatalog(partsDir);
  const files = (await readdir(boardsDir)).filter((entry) => entry.endsWith(".json")).sort();

  for (const file of files) {
    const fullPath = path.join(boardsDir, file);
    const board = await loadJson(fullPath);
    const controller = resolveController(board, parts);
    const resolvedSignals = resolveSignals(board, controller);
    const busIndex = buildBusIndex(board);
    const deviceIndex = buildDeviceIndex(board, parts);
    const headerPath = path.join(generatedDir, `${board.boardId}.h`);
    const sourcePath = path.join(generatedDir, `${board.boardId}.c`);
    await writeFile(headerPath, generateHeader(board, resolvedSignals), "utf8");
    await writeFile(sourcePath, generateSource(board, controller, resolvedSignals, busIndex, deviceIndex), "utf8");
    console.log(`Generated ${path.basename(headerPath)} and ${path.basename(sourcePath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

