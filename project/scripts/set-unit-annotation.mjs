import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const annotationsPath = path.join(projectRoot, "device-manager", "data", "unit-annotations.json");
const historyPath = path.join(projectRoot, "device-manager", "data", "unit-history.json");

function parseArgs(argv) {
  const result = {
    stableKey: null,
    label: null,
    note: null,
    owner: null,
    location: null,
    purpose: null,
    clearNotes: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--unit":
        result.stableKey = next;
        index += 1;
        break;
      case "--label":
        result.label = next;
        index += 1;
        break;
      case "--note":
        result.note = next;
        index += 1;
        break;
      case "--owner":
        result.owner = next;
        index += 1;
        break;
      case "--location":
        result.location = next;
        index += 1;
        break;
      case "--purpose":
        result.purpose = next;
        index += 1;
        break;
      case "--clear-notes":
        result.clearNotes = true;
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

function normalizeNotes(existingNotes, nextNote, clearNotes) {
  if (clearNotes) return nextNote ? [nextNote] : [];
  const notes = Array.isArray(existingNotes) ? [...existingNotes] : [];
  if (nextNote) notes.push(nextNote);
  return Array.from(new Set(notes.map((entry) => String(entry).trim()).filter(Boolean)));
}

function uniqueSorted(values) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort();
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
  const hasValues = Boolean(annotation.owner || annotation.location || annotation.purpose);
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
    owners: uniqueSorted([...(history.owners ?? []), annotation.owner]),
    locations: uniqueSorted([...(history.locations ?? []), annotation.location]),
    purposes: uniqueSorted([...(history.purposes ?? []), annotation.purpose]),
    firstUpdatedAt: history.firstUpdatedAt ?? (entry?.updatedAt ?? null),
    lastUpdatedAt: entry?.updatedAt ?? history.lastUpdatedAt ?? null,
    entries: entry && !sameAsLast ? [...history.entries, entry] : history.entries,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stableKey) {
    throw new Error("Missing required --unit <stableKey> argument.");
  }

  const history = await readJsonOrDefault(historyPath, { generatedAt: null, host: {}, units: [], families: [] });
  const knownUnitIndex = Array.isArray(history.units) ? history.units.findIndex((unit) => unit.stableKey === args.stableKey) : -1;
  const knownUnit = knownUnitIndex >= 0 ? history.units[knownUnitIndex] : null;
  if (!knownUnit) {
    throw new Error(`Stable unit '${args.stableKey}' is not present in unit-history.json.`);
  }

  const annotations = await readJsonOrDefault(annotationsPath, { updatedAt: null, units: [] });
  const units = Array.isArray(annotations.units) ? annotations.units : [];
  const index = units.findIndex((unit) => unit.stableKey === args.stableKey);
  const current = index >= 0 ? units[index] : { stableKey: args.stableKey, notes: [] };
  const timestamp = new Date().toISOString();

  const next = {
    stableKey: args.stableKey,
    label: args.label ?? current.label ?? null,
    notes: normalizeNotes(current.notes, args.note, args.clearNotes),
    owner: args.owner ?? current.owner ?? null,
    location: args.location ?? current.location ?? null,
    purpose: args.purpose ?? current.purpose ?? null,
    updatedAt: timestamp,
  };

  if (index >= 0) units[index] = next;
  else units.push(next);

  annotations.updatedAt = timestamp;
  annotations.units = units.sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  await writeFile(annotationsPath, `${JSON.stringify(annotations, null, 2)}\n`, "utf8");

  const nextHistoryUnit = {
    ...knownUnit,
    annotation: next,
    metadataHistory: mergeMetadataHistory(knownUnit.metadataHistory, next, timestamp),
  };
  history.units[knownUnitIndex] = nextHistoryUnit;
  history.generatedAt = timestamp;
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");

  console.log(`Updated annotations for ${args.stableKey}`);
  if (next.label) console.log(`Label: ${next.label}`);
  if (next.owner) console.log(`Owner: ${next.owner}`);
  if (next.location) console.log(`Location: ${next.location}`);
  if (next.purpose) console.log(`Purpose: ${next.purpose}`);
  if (next.notes.length > 0) console.log(`Notes: ${next.notes.join(' | ')}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
