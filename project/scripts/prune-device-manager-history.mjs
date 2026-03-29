import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataRoot = path.join(projectRoot, "device-manager", "data");
const profilesRoot = path.join(projectRoot, "device-manager", "profiles");

const DEFAULTS = {
  maxRuns: 50,
  maxObservedValues: 12,
  maxRawSignatureLines: 20,
  maxMetadataEntries: 50,
  maxConflicts: 100,
  maxProfileNotes: 20,
  maxReconciliationHistory: 20,
};

function capArray(values, limit) {
  if (!Array.isArray(values)) return values;
  if (values.length <= limit) return values;
  return values.slice(-limit);
}

function parseArgs(argv) {
  const result = { ...DEFAULTS, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--max-runs":
        result.maxRuns = Number.parseInt(next ?? String(result.maxRuns), 10);
        index += 1;
        break;
      case "--max-observed-values":
        result.maxObservedValues = Number.parseInt(next ?? String(result.maxObservedValues), 10);
        index += 1;
        break;
      case "--max-raw-signatures":
        result.maxRawSignatureLines = Number.parseInt(next ?? String(result.maxRawSignatureLines), 10);
        index += 1;
        break;
      case "--max-metadata-entries":
        result.maxMetadataEntries = Number.parseInt(next ?? String(result.maxMetadataEntries), 10);
        index += 1;
        break;
      case "--max-conflicts":
        result.maxConflicts = Number.parseInt(next ?? String(result.maxConflicts), 10);
        index += 1;
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      default:
        break;
    }
  }
  return result;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pruneObserved(observed, options, summary) {
  if (!observed || typeof observed !== "object") return observed;
  const next = { ...observed };
  for (const [key, value] of Object.entries(next)) {
    if (!Array.isArray(value)) continue;
    const limit = key === "rawSignatureLines" ? options.maxRawSignatureLines : options.maxObservedValues;
    const trimmed = capArray(value, limit);
    if (trimmed.length !== value.length) {
      summary.prunedObservedArrays += 1;
      summary.prunedObservedValues += value.length - trimmed.length;
      next[key] = trimmed;
    }
  }
  return next;
}

function pruneMetadataHistory(metadataHistory, options, summary) {
  if (!metadataHistory || typeof metadataHistory !== "object") return metadataHistory;
  const entries = Array.isArray(metadataHistory.entries) ? metadataHistory.entries : [];
  const trimmedEntries = capArray(entries, options.maxMetadataEntries);
  if (trimmedEntries.length !== entries.length) {
    summary.prunedMetadataEntries += entries.length - trimmedEntries.length;
  }
  return {
    ...metadataHistory,
    entries: trimmedEntries,
  };
}

function pruneConflicts(conflicts, options, summary) {
  const active = (conflicts ?? []).filter((entry) => entry.status !== "resolved");
  const resolved = (conflicts ?? []).filter((entry) => entry.status === "resolved");
  const keptResolved = capArray(resolved, options.maxConflicts);
  if (keptResolved.length !== resolved.length) {
    summary.prunedConflicts += resolved.length - keptResolved.length;
  }
  return [...active, ...keptResolved].sort((left, right) => String(left.conflictId).localeCompare(String(right.conflictId)));
}

function pruneProfile(profile, summary) {
  const next = { ...profile };
  if (Array.isArray(next.notes)) {
    const trimmedNotes = capArray(next.notes, DEFAULTS.maxProfileNotes);
    if (trimmedNotes.length !== next.notes.length) {
      summary.prunedProfileNotes += next.notes.length - trimmedNotes.length;
      next.notes = trimmedNotes;
    }
  }
  if (Array.isArray(next.reconciliationHistory)) {
    const trimmedHistory = capArray(next.reconciliationHistory, DEFAULTS.maxReconciliationHistory);
    if (trimmedHistory.length !== next.reconciliationHistory.length) {
      summary.prunedReconciliationEntries += next.reconciliationHistory.length - trimmedHistory.length;
      next.reconciliationHistory = trimmedHistory;
    }
  }
  return next;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const historyPath = path.join(dataRoot, "unit-history.json");
  const runsPath = path.join(dataRoot, "discovery-runs.json");
  const history = await readJson(historyPath, { generatedAt: null, host: {}, units: [], families: [], conflicts: [] });
  const discoveryRuns = await readJson(runsPath, { generatedAt: null, host: {}, runs: [] });
  const summary = {
    dryRun: options.dryRun,
    maxRuns: options.maxRuns,
    maxObservedValues: options.maxObservedValues,
    maxRawSignatureLines: options.maxRawSignatureLines,
    maxMetadataEntries: options.maxMetadataEntries,
    maxConflicts: options.maxConflicts,
    prunedRuns: 0,
    prunedObservedArrays: 0,
    prunedObservedValues: 0,
    prunedMetadataEntries: 0,
    prunedConflicts: 0,
    prunedProfileNotes: 0,
    prunedReconciliationEntries: 0,
  };

  history.units = (history.units ?? []).map((unit) => ({
    ...unit,
    observed: pruneObserved(unit.observed, options, summary),
    metadataHistory: pruneMetadataHistory(unit.metadataHistory, options, summary),
  }));

  history.conflicts = pruneConflicts(history.conflicts ?? [], options, summary);

  const runs = Array.isArray(discoveryRuns.runs) ? discoveryRuns.runs : [];
  const trimmedRuns = capArray(runs, options.maxRuns);
  if (trimmedRuns.length !== runs.length) {
    summary.prunedRuns = runs.length - trimmedRuns.length;
    discoveryRuns.runs = trimmedRuns;
  }

  const profiles = [];
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(profilesRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = path.join(profilesRoot, entry.name);
      const profile = await readJson(filePath, null);
      if (profile) profiles.push({ filePath, profile });
    }
  } catch {
  }

  if (!options.dryRun) {
    await writeJson(historyPath, history);
    await writeJson(runsPath, discoveryRuns);
    for (const entry of profiles) {
      await writeJson(entry.filePath, pruneProfile(entry.profile, summary));
    }
  } else {
    for (const entry of profiles) {
      pruneProfile(entry.profile, summary);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
