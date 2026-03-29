import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBoardCatalog, buildExactBoard, deriveBoardCandidates } from "./discovery-board-catalog.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const deviceManagerRoot = path.join(projectRoot, "device-manager");
const dataRoot = path.join(deviceManagerRoot, "data");
const profilesRoot = path.join(deviceManagerRoot, "profiles");

function sanitizeSegment(text) {
  return String(text ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "unknown";
}

function uniqueSorted(values) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort();
}

function pickEarlierTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left ?? null;
  return String(left).localeCompare(String(right)) <= 0 ? left : right;
}

function pickLaterTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left ?? null;
  return String(left).localeCompare(String(right)) >= 0 ? left : right;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadProfiles() {
  const entries = await readdir(profilesRoot, { withFileTypes: true });
  const profiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(profilesRoot, entry.name);
    profiles.push({
      filePath,
      data: JSON.parse(await readFile(filePath, "utf8")),
    });
  }
  return profiles.sort((left, right) => left.data.profileId.localeCompare(right.data.profileId));
}

function parseArgs(argv) {
  const result = {
    profileId: null,
    familyKey: null,
    boardId: null,
    note: null,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--profile":
        result.profileId = next ?? null;
        index += 1;
        break;
      case "--family":
        result.familyKey = next ?? null;
        index += 1;
        break;
      case "--board":
        result.boardId = next ?? null;
        index += 1;
        break;
      case "--note":
        result.note = next ?? null;
        index += 1;
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      default:
        break;
    }
  }

  if ((!result.profileId && !result.familyKey) || !result.boardId) {
    throw new Error("Usage: node project/scripts/reconcile-family-profile.mjs --profile <profileId>|--family <familyKey> --board <boardId> [--note <text>] [--dry-run]");
  }

  return result;
}

function resolveSourceProfile(profiles, options) {
  const matches = profiles.filter((entry) => {
    if (options.profileId && entry.data.profileId === options.profileId) return true;
    if (options.familyKey && entry.data.familyKey === options.familyKey) return true;
    return false;
  });

  if (matches.length === 0) {
    throw new Error(`No family profile matched ${options.profileId ? `profile '${options.profileId}'` : `family '${options.familyKey}'`}.`);
  }

  if (matches.length > 1) {
    throw new Error("Multiple family profiles matched the requested selector. Narrow the request with --profile.");
  }

  return matches[0];
}

function ensureDestinationFamily(history, boardId, timestamp, boardSummary, sourceFamily, affectedUnitIds) {
  const familyKey = `board:${boardId}`;
  const profileId = `board_${sanitizeSegment(boardId)}`;
  const existingFamily = (history.families ?? []).find((entry) => entry.familyKey === familyKey) ?? null;
  const combinedSampleUnits = uniqueSorted([
    ...(existingFamily?.sampleUnitIds ?? []),
    ...(sourceFamily?.sampleUnitIds ?? []),
    ...affectedUnitIds,
  ]).slice(0, 16);

  return {
    familyKey,
    firstSeenAt: pickEarlierTimestamp(existingFamily?.firstSeenAt ?? null, sourceFamily?.firstSeenAt ?? null) ?? timestamp,
    lastSeenAt: pickLaterTimestamp(existingFamily?.lastSeenAt ?? null, sourceFamily?.lastSeenAt ?? null) ?? timestamp,
    lastPresentAt: pickLaterTimestamp(existingFamily?.lastPresentAt ?? null, sourceFamily?.lastPresentAt ?? null),
    lastMissingAt: pickLaterTimestamp(existingFamily?.lastMissingAt ?? null, sourceFamily?.lastMissingAt ?? null),
    present: true,
    presentUnitCount: existingFamily?.presentUnitCount ?? 0,
    missingUnitCount: existingFamily?.missingUnitCount ?? 0,
    seenCount: (existingFamily?.seenCount ?? 0) + (sourceFamily?.seenCount ?? 0),
    status: "known-board",
    profileId,
    boardIds: [boardId],
    sampleUnitIds: combinedSampleUnits,
    transitions: existingFamily?.transitions ?? sourceFamily?.transitions ?? {},
    fingerprint: {
      ...(sourceFamily?.fingerprint ?? {}),
      fingerprintKey: `board:${boardId}`,
      capabilities: boardSummary.capabilities ?? sourceFamily?.fingerprint?.capabilities ?? [],
    },
    resolvedBoardId: boardId,
  };
}

function updateLatestRun(discoveryRuns, sourceFamilyKey, affectedUnitIds, targetBoardId, targetFamilyKey) {
  const runs = Array.isArray(discoveryRuns.runs) ? discoveryRuns.runs : [];
  const latestRun = runs.at(-1);
  if (!latestRun) return;

  latestRun.units = (latestRun.units ?? []).map((unit) => {
    if (!affectedUnitIds.includes(unit.stableKey)) return unit;
    return {
      ...unit,
      boardId: targetBoardId,
      familyKey: targetFamilyKey,
    };
  });

  const familyMap = new Map((latestRun.families ?? []).map((family) => [family.familyKey, family]));
  const sourceFamily = familyMap.get(sourceFamilyKey) ?? null;
  const targetFamily = familyMap.get(targetFamilyKey) ?? {
    familyKey: targetFamilyKey,
    boardId: targetBoardId,
    presentUnitCount: 0,
    sampleUnitIds: [],
  };

  targetFamily.boardId = targetBoardId;
  targetFamily.presentUnitCount = (targetFamily.presentUnitCount ?? 0) + affectedUnitIds.length;
  targetFamily.sampleUnitIds = uniqueSorted([...(targetFamily.sampleUnitIds ?? []), ...affectedUnitIds]).slice(0, 16);
  familyMap.set(targetFamilyKey, targetFamily);

  if (sourceFamily && sourceFamily.familyKey !== targetFamilyKey) {
    const nextCount = Math.max(0, (sourceFamily.presentUnitCount ?? 0) - affectedUnitIds.length);
    if (nextCount === 0) {
      familyMap.delete(sourceFamily.familyKey);
    } else {
      sourceFamily.presentUnitCount = nextCount;
      sourceFamily.sampleUnitIds = (sourceFamily.sampleUnitIds ?? []).filter((stableKey) => !affectedUnitIds.includes(stableKey));
      familyMap.set(sourceFamily.familyKey, sourceFamily);
    }
  }

  latestRun.familyCount = familyMap.size;
  latestRun.families = Array.from(familyMap.values()).sort((left, right) => left.familyKey.localeCompare(right.familyKey));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString();
  const boardCatalog = await loadBoardCatalog(projectRoot);
  const boardSummary = buildExactBoard(options.boardId, boardCatalog);
  if (!boardSummary) {
    throw new Error(`Board '${options.boardId}' does not exist in the Stage 1 board catalog.`);
  }

  const profiles = await loadProfiles();
  const sourceProfileEntry = resolveSourceProfile(profiles, options);
  const sourceProfile = sourceProfileEntry.data;
  const history = await readJson(path.join(dataRoot, "unit-history.json"), { generatedAt: null, host: {}, units: [], families: [], conflicts: [] });
  const inventory = await readJson(path.join(dataRoot, "inventory.json"), { generatedAt: null, host: {}, units: [] });
  const discoveryRuns = await readJson(path.join(dataRoot, "discovery-runs.json"), { generatedAt: null, host: {}, runs: [] });

  const sourceFamily = (history.families ?? []).find((entry) => entry.profileId === sourceProfile.profileId || entry.familyKey === sourceProfile.familyKey) ?? null;
  const affectedUnits = (history.units ?? []).filter((entry) => entry.profileId === sourceProfile.profileId || entry.familyKey === sourceProfile.familyKey);
  const affectedUnitIds = affectedUnits.map((entry) => entry.stableKey).sort();

  const targetFamilyKey = `board:${options.boardId}`;
  const targetProfileId = `board_${sanitizeSegment(options.boardId)}`;

  const summary = {
    sourceProfileId: sourceProfile.profileId,
    sourceFamilyKey: sourceProfile.familyKey,
    targetBoardId: options.boardId,
    targetProfileId,
    targetFamilyKey,
    affectedUnitIds,
    sourceStatus: sourceProfile.status ?? null,
    dryRun: options.dryRun,
  };

  if (affectedUnitIds.length === 0) {
    summary.warning = "The selected profile currently has no units attached in history. Reconciliation is still allowed, but no unit records would move.";
  }

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  for (const unit of history.units ?? []) {
    if (!affectedUnitIds.includes(unit.stableKey)) continue;
    unit.familyKey = targetFamilyKey;
    unit.profileId = targetProfileId;
    unit.boardIds = uniqueSorted([...(unit.boardIds ?? []), options.boardId]);
  }

  const destinationFamily = ensureDestinationFamily(history, options.boardId, timestamp, boardSummary, sourceFamily, affectedUnitIds);
  const sourceFamilyIndex = (history.families ?? []).findIndex((entry) => entry.familyKey === sourceProfile.familyKey);
  const destinationFamilyIndex = (history.families ?? []).findIndex((entry) => entry.familyKey === targetFamilyKey);

  if (destinationFamilyIndex >= 0) {
    history.families[destinationFamilyIndex] = {
      ...history.families[destinationFamilyIndex],
      ...destinationFamily,
      sampleUnitIds: uniqueSorted([
        ...(history.families[destinationFamilyIndex].sampleUnitIds ?? []),
        ...destinationFamily.sampleUnitIds,
      ]).slice(0, 16),
    };
  } else {
    history.families.push(destinationFamily);
  }

  if (sourceFamilyIndex >= 0) {
    const existing = history.families[sourceFamilyIndex];
    history.families[sourceFamilyIndex] = {
      ...existing,
      status: "merged",
      present: false,
      presentUnitCount: 0,
      missingUnitCount: 0,
      boardIds: uniqueSorted([...(existing.boardIds ?? []), options.boardId]),
      resolvedBoardId: options.boardId,
      mergedIntoProfileId: targetProfileId,
      mergedIntoFamilyKey: targetFamilyKey,
      reconciledAt: timestamp,
    };
  }

  history.families = history.families.sort((left, right) => String(left.familyKey).localeCompare(String(right.familyKey)));
  history.generatedAt = timestamp;

  for (const unit of inventory.units ?? []) {
    const stableKey = unit.unitId ?? unit.identity?.stableKey;
    if (!affectedUnitIds.includes(stableKey)) continue;
    unit.match = {
      status: "matched",
      boardId: options.boardId,
      reason: `Operator reconciled family profile ${sourceProfile.profileId} to board ${options.boardId}`,
      source: "family-reconciliation",
    };
    unit.history = {
      ...(unit.history ?? {}),
      familyKey: targetFamilyKey,
      profileId: targetProfileId,
    };
  }
  inventory.generatedAt = timestamp;

  const sourceReconciliationEntry = {
    reconciledAt: timestamp,
    resolvedBoardId: options.boardId,
    mergedIntoProfileId: targetProfileId,
    mergedIntoFamilyKey: targetFamilyKey,
    note: options.note ?? null,
    affectedUnitIds,
  };

  const nextSourceProfile = {
    ...sourceProfile,
    updatedAt: timestamp,
    status: "merged",
    resolvedBoardId: options.boardId,
    mergedIntoProfileId: targetProfileId,
    mergedIntoFamilyKey: targetFamilyKey,
    reconciledAt: timestamp,
    boardIds: uniqueSorted([...(sourceProfile.boardIds ?? []), options.boardId]),
    exactBoard: buildExactBoard(options.boardId, boardCatalog),
    candidateBoards: deriveBoardCandidates(sourceProfile.fingerprint, [options.boardId], boardCatalog),
    notes: uniqueSorted([
      ...(sourceProfile.notes ?? []),
      options.note,
      `Operator reconciled this draft family profile to board ${options.boardId}.`,
    ]),
    reconciliationHistory: [...(sourceProfile.reconciliationHistory ?? []), sourceReconciliationEntry],
  };

  const destinationProfilePath = path.join(profilesRoot, `${targetProfileId}.json`);
  const existingDestinationProfile = await readJson(destinationProfilePath, null);
  const nextDestinationProfile = existingDestinationProfile ?? {
    profileId: targetProfileId,
    familyKey: targetFamilyKey,
    status: "known-family",
    createdAt: timestamp,
    updatedAt: timestamp,
    boardIds: [options.boardId],
    sampleUnitIds: [],
    fingerprint: sourceProfile.fingerprint,
    notes: [
      "Discovery created this family profile from known board observations.",
    ],
  };

  nextDestinationProfile.updatedAt = timestamp;
  nextDestinationProfile.status = "known-board";
  nextDestinationProfile.resolvedBoardId = options.boardId;
  nextDestinationProfile.boardIds = [options.boardId];
  nextDestinationProfile.sampleUnitIds = uniqueSorted([...(nextDestinationProfile.sampleUnitIds ?? []), ...affectedUnitIds]).slice(0, 16);
  nextDestinationProfile.exactBoard = buildExactBoard(options.boardId, boardCatalog);
  nextDestinationProfile.candidateBoards = deriveBoardCandidates(sourceProfile.fingerprint, [options.boardId], boardCatalog);
  nextDestinationProfile.notes = uniqueSorted([
    ...(nextDestinationProfile.notes ?? []),
    options.note,
    `Family profile ${sourceProfile.profileId} was reconciled into this board profile.`,
  ]);
  nextDestinationProfile.reconciliationHistory = [
    ...(nextDestinationProfile.reconciliationHistory ?? []),
    sourceReconciliationEntry,
  ];

  updateLatestRun(discoveryRuns, sourceProfile.familyKey, affectedUnitIds, options.boardId, targetFamilyKey);
  discoveryRuns.generatedAt = timestamp;

  await mkdir(profilesRoot, { recursive: true });
  await writeFile(path.join(dataRoot, "unit-history.json"), `${JSON.stringify(history, null, 2)}\n`, "utf8");
  await writeFile(path.join(dataRoot, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  await writeFile(path.join(dataRoot, "discovery-runs.json"), `${JSON.stringify(discoveryRuns, null, 2)}\n`, "utf8");
  await writeFile(sourceProfileEntry.filePath, `${JSON.stringify(nextSourceProfile, null, 2)}\n`, "utf8");
  await writeFile(destinationProfilePath, `${JSON.stringify(nextDestinationProfile, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ...summary,
    reconciledAt: timestamp,
    destinationProfileCreated: existingDestinationProfile === null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
