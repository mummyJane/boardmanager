import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const boardsDir = path.join(projectRoot, "boards");
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

function generateHeader(board) {
  const guard = `${upperName(board.boardId)}_H`;
  const lines = [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    '#include "../firmware-common/board_api.h"',
    "",
    `extern const board_descriptor_t ${board.boardId}_descriptor;`,
    "",
    `void ${board.boardId}_init(void);`
  ];

  for (const signal of board.io) {
    if (signal.kind === "digital_output") {
      lines.push(`void ${board.boardId}_${signal.name}_set(bool enabled);`);
    } else if (signal.kind === "digital_input") {
      lines.push(`bool ${board.boardId}_${signal.name}_read(void);`);
    }
  }

  lines.push("", `#endif`);
  return `${lines.join("\n")}\n`;
}

function generateSource(board) {
  const arrayName = `${board.boardId}_io`;
  const lines = [
    `#include "${board.boardId}.h"`,
    "",
    `static const board_io_descriptor_t ${arrayName}[] = {`
  ];

  for (const signal of board.io) {
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
  lines.push(`    ${cString(board.mcu.family)},`);
  lines.push(`    ${cString(board.mcu.partNumber)},`);
  lines.push(`    ${board.io.length},`);
  lines.push(`    ${arrayName}`);
  lines.push("};", "", `void ${board.boardId}_init(void)`, "{", "    /* TODO: configure MCU pins and peripherals for this board. */", "}");

  for (const signal of board.io) {
    lines.push("");

    if (signal.kind === "digital_output") {
      lines.push(`void ${board.boardId}_${signal.name}_set(bool enabled)`, "{", "    (void)enabled;", "    /* TODO: drive the mapped MCU output. */", "}");
    } else if (signal.kind === "digital_input") {
      lines.push(`bool ${board.boardId}_${signal.name}_read(void)`, "{", "    /* TODO: read the mapped MCU input. */", "    return false;", "}");
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(generatedDir, { recursive: true });
  const files = (await readdir(boardsDir)).filter((entry) => entry.endsWith(".json")).sort();

  for (const file of files) {
    const fullPath = path.join(boardsDir, file);
    const board = JSON.parse(await readFile(fullPath, "utf8"));
    const headerPath = path.join(generatedDir, `${board.boardId}.h`);
    const sourcePath = path.join(generatedDir, `${board.boardId}.c`);
    await writeFile(headerPath, generateHeader(board), "utf8");
    await writeFile(sourcePath, generateSource(board), "utf8");
    console.log(`Generated ${path.basename(headerPath)} and ${path.basename(sourcePath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
