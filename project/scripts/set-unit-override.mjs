import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBoardCatalog } from "./discovery-board-catalog.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const overridesPath = path.join(projectRoot, "device-manager", "data", "unit-overrides.json");
const historyPath = path.join(projectRoot, "device-manager", "data", "unit-history.json");

function parseArgs(argv) {
  const result = {
    stableKey: null,
    boardId: null,
    familyKey: null,
    note: null,
    clear: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--unit":
        result.stableKey = next;
        index += 1;
        break;
      case "--board":
        result.boardId = next;
        index += 1;
        break;
      case "--family":
        result.familyKey = next;
        index += 1;
        break;
      case "--note":
        result.note = next;
        index += 1;
        break;
      case "--clear":
        result.clear = true;
        break;
      default:
        break;
    }
  }

  return result;
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stableKey) throw new Error("Missing required --unit <stableKey> argument.");

  const history = await readJsonOrDefault(historyPath, { units: [], families: [] });
  const knownUnit = (history.units ?? []).find((unit) => unit.stableKey === args.stableKey);
  if (!knownUnit) throw new Error(`Stable unit '${args.stableKey}' is not present in unit-history.json.`);

  const boardCatalog = await loadBoardCatalog(projectRoot);
  if (args.boardId && !boardCatalog.boards.some((board) => board.boardId === args.boardId)) {
    throw new Error(`Unknown boardId '${args.boardId}'.`);
  }

  if (args.familyKey && !(history.families ?? []).some((family) => family.familyKey === args.familyKey) && !String(args.familyKey).startsWith('board:') && !String(args.familyKey).startsWith('unknown:') && !String(args.familyKey).startsWith('transport:')) {
    throw new Error(`Unknown familyKey '${args.familyKey}'.`);
  }

  const overrides = await readJsonOrDefault(overridesPath, { updatedAt: null, units: [] });
  const units = Array.isArray(overrides.units) ? overrides.units : [];
  const index = units.findIndex((unit) => unit.stableKey === args.stableKey);
  const current = index >= 0 ? units[index] : { stableKey: args.stableKey };
  const timestamp = new Date().toISOString();

  if (args.clear) {
    if (index >= 0) units.splice(index, 1);
    overrides.updatedAt = timestamp;
    overrides.units = units.sort((left, right) => left.stableKey.localeCompare(right.stableKey));
    await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
    console.log(`Cleared override for ${args.stableKey}`);
    return;
  }

  const nextBoardId = args.boardId ?? current.boardId ?? null;
  const derivedFamilyKey = nextBoardId ? `board:${nextBoardId}` : null;
  const next = {
    stableKey: args.stableKey,
    boardId: nextBoardId,
    familyKey: args.familyKey ?? current.familyKey ?? derivedFamilyKey,
    note: args.note ?? current.note ?? null,
    updatedAt: timestamp,
  };

  if (index >= 0) units[index] = next;
  else units.push(next);

  overrides.updatedAt = timestamp;
  overrides.units = units.sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');

  console.log(`Updated override for ${args.stableKey}`);
  if (next.boardId) console.log(`Board override: ${next.boardId}`);
  if (next.familyKey) console.log(`Family override: ${next.familyKey}`);
  if (next.note) console.log(`Note: ${next.note}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
