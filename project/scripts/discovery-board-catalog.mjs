import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function simplifyChip(chip) {
  const text = String(chip ?? "").toLowerCase();
  if (text.includes("esp32-s3")) return "esp32-s3";
  if (text.includes("esp32")) return "esp32";
  if (text.includes("stm32f0")) return "stm32f0";
  if (text.includes("stm32f4")) return "stm32f4";
  return chip ?? null;
}

function summarizeCapabilities(capabilities) {
  return Object.entries(capabilities ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name)
    .sort();
}

async function loadJsonRecords(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const records = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(directory, entry.name);
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    records.push(parsed);
  }

  return records;
}

function inferPlatformSdk(chipFamily) {
  if ((chipFamily ?? "").startsWith("esp32")) return "esp-idf";
  if ((chipFamily ?? "").startsWith("stm32")) return "stm32cube";
  return null;
}

function buildBoardSummaries(boards, modules, mcus) {
  const moduleMap = new Map(modules.map((part) => [part.partId, part]));
  const mcuMap = new Map(mcus.map((part) => [part.partId, part]));

  return boards.map((board) => {
    const controllerModuleId = board.controller?.moduleId ?? null;
    const module = controllerModuleId ? moduleMap.get(controllerModuleId) : null;
    const mcu = module?.mcuId ? mcuMap.get(module.mcuId) : null;
    const chipLabel = mcu?.displayName ?? mcu?.partId ?? module?.mcuId ?? controllerModuleId;
    const chipFamily = simplifyChip(chipLabel);

    return {
      boardId: board.boardId,
      displayName: board.displayName ?? board.boardId,
      revision: board.revision ?? null,
      vendor: board.vendor ?? null,
      productSku: board.productSku ?? null,
      controllerModuleId,
      chipFamily,
      platformSdk: inferPlatformSdk(chipFamily),
      capabilities: summarizeCapabilities(board.capabilities),
      sources: Array.isArray(board.sources) ? board.sources : [],
    };
  });
}

function scoreBoardCandidate(fingerprint, board) {
  let score = 0;
  const reasons = [];
  const chipFamily = fingerprint?.chipFamily ?? null;
  const vid = fingerprint?.vid ?? null;
  const pid = fingerprint?.pid ?? null;
  const description = `${fingerprint?.description ?? ""} ${fingerprint?.name ?? ""}`.toLowerCase();
  const signature = String(fingerprint?.firmwareSignature ?? "").toLowerCase();
  const boardText = `${board.boardId} ${board.displayName}`.toLowerCase();

  if (chipFamily && board.chipFamily === chipFamily) {
    score += 6;
    reasons.push(`Chip family matches ${chipFamily}`);
  }

  if (vid === "303A" && pid === "1001" && (board.chipFamily ?? "").startsWith("esp32")) {
    score += 3;
    reasons.push("Espressif USB fingerprint fits an ESP32 board");
  }

  if (vid === "0483" && pid === "374B" && board.vendor === "STMicroelectronics") {
    score += 3;
    reasons.push("ST-LINK USB fingerprint fits an STMicroelectronics board");
  }

  if (description.includes("stlink") && board.vendor === "STMicroelectronics") {
    score += 2;
    reasons.push("Transport name matches ST-LINK based board family");
  }

  if (signature.includes("dial") && boardText.includes("dial")) {
    score += 6;
    reasons.push("Firmware signature resembles the Dial family");
  }

  if (signature.includes("cores3") && boardText.includes("cores3")) {
    score += 6;
    reasons.push("Firmware signature resembles the CoreS3 family");
  }

  if (boardText.includes("nucleo") && description.includes("stlink")) {
    score += 2;
    reasons.push("Board name and transport both resemble a Nucleo board");
  }

  return { score, reasons };
}

export async function loadBoardCatalog(projectRoot) {
  const boards = await loadJsonRecords(path.join(projectRoot, "boards"));
  const modules = await loadJsonRecords(path.join(projectRoot, "parts", "modules"));
  const mcus = await loadJsonRecords(path.join(projectRoot, "parts", "mcu"));

  return {
    boards: buildBoardSummaries(boards, modules, mcus),
  };
}

export function deriveBoardCandidates(fingerprint, boardIds, boardCatalog) {
  const exactBoardIds = new Set((boardIds ?? []).filter(Boolean));

  const scored = boardCatalog.boards
    .map((board) => {
      if (exactBoardIds.has(board.boardId)) {
        return {
          ...board,
          score: 100,
          reasons: ["Exact board definition match from discovery history"],
        };
      }

      const { score, reasons } = scoreBoardCandidate(fingerprint, board);
      return {
        ...board,
        score,
        reasons,
      };
    })
    .filter((board) => board.score > 0)
    .sort((left, right) => right.score - left.score || left.boardId.localeCompare(right.boardId))
    .slice(0, 5)
    .map(({ score, reasons, ...board }) => ({ ...board, score, reasons }));

  return scored;
}

export function buildExactBoard(boardId, boardCatalog) {
  return boardCatalog.boards.find((board) => board.boardId === boardId) ?? null;
}
