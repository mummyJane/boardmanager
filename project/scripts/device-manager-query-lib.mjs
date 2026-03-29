import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const inventoryPath = path.join(projectRoot, "device-manager", "data", "inventory.json");
const historyPath = path.join(projectRoot, "device-manager", "data", "unit-history.json");
const discoveryRunsPath = path.join(projectRoot, "device-manager", "data", "discovery-runs.json");

export function parseQueryArgs(argv) {
  const result = {
    view: "units",
    format: "text",
    limit: 20,
    presentOnly: false,
    family: null,
    unit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--view":
        result.view = next ?? result.view;
        index += 1;
        break;
      case "--format":
        result.format = next ?? result.format;
        index += 1;
        break;
      case "--limit":
        result.limit = Number.parseInt(next ?? String(result.limit), 10);
        index += 1;
        break;
      case "--present-only":
        result.presentOnly = true;
        break;
      case "--family":
        result.family = next ?? null;
        index += 1;
        break;
      case "--unit":
        result.unit = next ?? null;
        index += 1;
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

function pickLabel(unit) {
  return unit.annotation?.label ?? unit.identity?.stableKey ?? unit.stableKey ?? null;
}

function latestArrayValue(values) {
  if (Array.isArray(values) && values.length > 0) {
    return values[values.length - 1];
  }

  return null;
}

function parseCapabilitySet(value) {
  if (!value) {
    return [];
  }

  return String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
}

function pickPreferredUsbTopologyPath(values) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  return items.find((entry) => String(entry).includes('/')) ?? latestArrayValue(items);
}
function mapUnit(unit) {
  return {
    stableKey: unit.stableKey,
    priorStableKeys: Array.isArray(unit.identity?.priorStableKeys) ? unit.identity.priorStableKeys : [],
    boardId: unit.manualOverride?.boardId ?? unit.boardIds?.[unit.boardIds.length - 1] ?? null,
    familyKey: unit.familyKey,
    present: unit.present !== false,
    presentPort: unit.present !== false ? unit.lastTransport?.port ?? null : null,
    lastSeenAt: unit.lastSeenAt ?? null,
    lastPresentAt: unit.lastPresentAt ?? null,
    lastMissingAt: unit.lastMissingAt ?? null,
    seenCount: unit.seenCount ?? 0,
    missingCount: unit.missingCount ?? 0,
    firmwareApp: latestArrayValue(unit.observed?.firmwareApps) ?? null,
    firmwareVersion: latestArrayValue(unit.observed?.firmwareVersions) ?? null,
    firmwareBoard: latestArrayValue(unit.observed?.firmwareBoards) ?? null,
    firmwareCapabilities: parseCapabilitySet(latestArrayValue(unit.observed?.agentCapabilitySets)),
    usbManufacturer: latestArrayValue(unit.observed?.usbManufacturers) ?? null,
    usbProductName: latestArrayValue(unit.observed?.usbProductNames) ?? null,
    usbServices: Array.isArray(unit.observed?.usbServices) ? unit.observed.usbServices : [],
    usbRevision: latestArrayValue(unit.observed?.usbRevisions) ?? null,
    usbBaseSerialNumber: latestArrayValue(unit.observed?.usbBaseSerialNumbers) ?? null,
    usbParentIdPrefix: latestArrayValue(unit.observed?.usbParentIdPrefixes) ?? null,
    usbEnumeratorName: latestArrayValue(unit.observed?.usbEnumeratorNames) ?? null,
    usbClassName: latestArrayValue(unit.observed?.usbClassNames) ?? null,
    usbDriver: latestArrayValue(unit.observed?.usbDrivers) ?? null,
    usbTopologyPath: pickPreferredUsbTopologyPath(unit.observed?.usbTopologyPaths) ?? null,
    usbLocationInformation: latestArrayValue(unit.observed?.usbLocationInformation) ?? null,
    usbFunctionNames: Array.isArray(unit.observed?.usbFunctionNames) ? unit.observed.usbFunctionNames : [],
    owner: unit.annotation?.owner ?? null,
    location: unit.annotation?.location ?? null,
    purpose: unit.annotation?.purpose ?? null,
    overrideBoardId: unit.manualOverride?.boardId ?? null,
    overrideFamilyKey: unit.manualOverride?.familyKey ?? null,
    overrideNote: unit.manualOverride?.note ?? null,
    label: pickLabel(unit),
  };
}

function mapConflict(conflict) {
  return {
    conflictId: conflict.conflictId,
    kind: conflict.kind ?? null,
    status: conflict.status ?? null,
    chosenStableKey: conflict.chosenStableKey ?? null,
    candidateStableKeys: Array.isArray(conflict.candidateStableKeys) ? conflict.candidateStableKeys : [],
    firstSeenAt: conflict.firstSeenAt ?? null,
    lastSeenAt: conflict.lastSeenAt ?? null,
    lastResolvedAt: conflict.lastResolvedAt ?? null,
    count: conflict.count ?? 0,
    summary: conflict.summary ?? null,
  };
}

function mapFamily(family) {
  return {
    familyKey: family.familyKey,
    boardId: family.boardIds?.length === 1 ? family.boardIds[0] : null,
    present: family.present !== false,
    firstSeenAt: family.firstSeenAt ?? null,
    lastSeenAt: family.lastSeenAt ?? null,
    lastPresentAt: family.lastPresentAt ?? null,
    lastMissingAt: family.lastMissingAt ?? null,
    presentUnitCount: family.presentUnitCount ?? 0,
    missingUnitCount: family.missingUnitCount ?? 0,
    seenCount: family.seenCount ?? 0,
    sampleUnitIds: family.sampleUnitIds ?? [],
  };
}

function buildChangeEntries(history) {
  const entries = [];

  for (const unit of history.units ?? []) {
    const label = pickLabel(unit);
    const transitions = unit.transitions ?? {};
    if (transitions.lastSeen?.at) {
      entries.push({
        at: transitions.lastSeen.at,
        scope: "unit",
        target: unit.stableKey,
        type: transitions.lastSeen.state ?? "observed",
        summary: `${label} observed${unit.lastTransport?.port ? ` on ${unit.lastTransport.port}` : ""}`,
      });
    }
    if (transitions.lastPresent?.at) {
      entries.push({
        at: transitions.lastPresent.at,
        scope: "unit",
        target: unit.stableKey,
        type: transitions.lastPresent.state ?? "present",
        summary: `${label} present${unit.lastTransport?.port ? ` on ${unit.lastTransport.port}` : ""}`,
      });
    }
    if (transitions.lastMissing?.at) {
      entries.push({
        at: transitions.lastMissing.at,
        scope: "unit",
        target: unit.stableKey,
        type: transitions.lastMissing.state ?? "missing",
        summary: `${label} marked missing`,
      });
    }
  }

  for (const family of history.families ?? []) {
    const transitions = family.transitions ?? {};
    if (transitions.lastMissing?.at) {
      entries.push({
        at: transitions.lastMissing.at,
        scope: "family",
        target: family.familyKey,
        type: transitions.lastMissing.state ?? "missing",
        summary: `${family.familyKey} family missing`,
      });
    }
    if (transitions.lastPresent?.at) {
      entries.push({
        at: transitions.lastPresent.at,
        scope: "family",
        target: family.familyKey,
        type: transitions.lastPresent.state ?? "present",
        summary: `${family.familyKey} family present with ${family.presentUnitCount ?? 0} unit(s)`,
      });
    }
  }

  for (const conflict of history.conflicts ?? []) {
    if (conflict.lastSeenAt) {
      entries.push({
        at: conflict.lastSeenAt,
        scope: "conflict",
        target: conflict.conflictId,
        type: conflict.status ?? "active",
        summary: conflict.summary ?? conflict.conflictId,
      });
    }
  }

  return entries.sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function filterUnits(units, args) {
  return units.filter((unit) => {
    if (args.presentOnly && unit.present === false) return false;
    if (args.family && unit.familyKey !== args.family) return false;
    if (args.unit && unit.stableKey !== args.unit) return false;
    return true;
  });
}

function filterFamilies(families, args) {
  return families.filter((family) => {
    if (args.presentOnly && family.present === false) return false;
    if (args.family && family.familyKey !== args.family) return false;
    return true;
  });
}

function mapByKey(items, key) {
  const result = new Map();
  for (const item of items ?? []) result.set(item[key], item);
  return result;
}

function buildDiffEntries(previousRun, currentRun) {
  if (!previousRun || !currentRun) return [];

  const entries = [];
  const previousUnits = mapByKey(previousRun.units, "stableKey");
  const currentUnits = mapByKey(currentRun.units, "stableKey");
  const allUnitKeys = Array.from(new Set([...previousUnits.keys(), ...currentUnits.keys()])).sort();

  for (const stableKey of allUnitKeys) {
    const previousUnit = previousUnits.get(stableKey) ?? null;
    const currentUnit = currentUnits.get(stableKey) ?? null;

    if (!previousUnit && currentUnit) {
      entries.push({
        scope: "unit",
        target: stableKey,
        type: "added",
        previous: null,
        current: currentUnit.port ?? null,
        summary: `${stableKey} added${currentUnit.port ? ` on ${currentUnit.port}` : ""}`,
      });
      continue;
    }

    if (previousUnit && !currentUnit) {
      entries.push({
        scope: "unit",
        target: stableKey,
        type: "removed",
        previous: previousUnit.port ?? null,
        current: null,
        summary: `${stableKey} removed${previousUnit.port ? ` from ${previousUnit.port}` : ""}`,
      });
      continue;
    }

    if (previousUnit.port !== currentUnit.port) {
      entries.push({
        scope: "unit",
        target: stableKey,
        type: "port-changed",
        previous: previousUnit.port ?? null,
        current: currentUnit.port ?? null,
        summary: `${stableKey} moved from ${previousUnit.port ?? "-"} to ${currentUnit.port ?? "-"}`,
      });
    }

    const previousFirmware = previousUnit.firmwareApp && previousUnit.firmwareVersion
      ? `${previousUnit.firmwareApp}@${previousUnit.firmwareVersion}`
      : previousUnit.firmwareApp ?? previousUnit.firmwareVersion ?? null;
    const currentFirmware = currentUnit.firmwareApp && currentUnit.firmwareVersion
      ? `${currentUnit.firmwareApp}@${currentUnit.firmwareVersion}`
      : currentUnit.firmwareApp ?? currentUnit.firmwareVersion ?? null;
    if (previousFirmware !== currentFirmware) {
      entries.push({
        scope: "unit",
        target: stableKey,
        type: "firmware-changed",
        previous: previousFirmware,
        current: currentFirmware,
        summary: `${stableKey} firmware changed from ${previousFirmware ?? "-"} to ${currentFirmware ?? "-"}`,
      });
    }
  }

  const previousFamilies = mapByKey(previousRun.families, "familyKey");
  const currentFamilies = mapByKey(currentRun.families, "familyKey");
  const allFamilyKeys = Array.from(new Set([...previousFamilies.keys(), ...currentFamilies.keys()])).sort();

  for (const familyKey of allFamilyKeys) {
    const previousFamily = previousFamilies.get(familyKey) ?? null;
    const currentFamily = currentFamilies.get(familyKey) ?? null;

    if (!previousFamily && currentFamily) {
      entries.push({
        scope: "family",
        target: familyKey,
        type: "added",
        previous: null,
        current: String(currentFamily.presentUnitCount ?? 0),
        summary: `${familyKey} family added with ${currentFamily.presentUnitCount ?? 0} present unit(s)`,
      });
      continue;
    }

    if (previousFamily && !currentFamily) {
      entries.push({
        scope: "family",
        target: familyKey,
        type: "removed",
        previous: String(previousFamily.presentUnitCount ?? 0),
        current: null,
        summary: `${familyKey} family removed from latest run`,
      });
      continue;
    }

    if ((previousFamily.presentUnitCount ?? 0) !== (currentFamily.presentUnitCount ?? 0)) {
      entries.push({
        scope: "family",
        target: familyKey,
        type: "population-changed",
        previous: String(previousFamily.presentUnitCount ?? 0),
        current: String(currentFamily.presentUnitCount ?? 0),
        summary: `${familyKey} present-unit count changed from ${previousFamily.presentUnitCount ?? 0} to ${currentFamily.presentUnitCount ?? 0}`,
      });
    }
  }

  return entries;
}

export function renderTextTable(rows, columns) {
  const widths = {};
  for (const column of columns) widths[column.key] = column.label.length;
  for (const row of rows) {
    for (const column of columns) {
      widths[column.key] = Math.max(widths[column.key], String(row[column.key] ?? "-").length);
    }
  }

  const header = columns.map((column) => column.label.padEnd(widths[column.key])).join("  ");
  const divider = columns.map((column) => "-".repeat(widths[column.key])).join("  ");
  const body = rows.map((row) => columns.map((column) => String(row[column.key] ?? "-").padEnd(widths[column.key])).join("  "));
  return [header, divider, ...body].join("\n");
}

export function renderQueryText(view, payload) {
  if (view === "units") {
    return renderTextTable(payload, [
      { key: "stableKey", label: "Unit" },
      { key: "boardId", label: "Board" },
      { key: "present", label: "Present" },
      { key: "presentPort", label: "Port" },
      { key: "firmwareVersion", label: "FW" },
      { key: "overrideBoardId", label: "Override" },
      { key: "location", label: "Location" },
      { key: "purpose", label: "Purpose" },
    ]);
  }

  if (view === "families") {
    return renderTextTable(payload, [
      { key: "familyKey", label: "Family" },
      { key: "boardId", label: "Board" },
      { key: "present", label: "Present" },
      { key: "presentUnitCount", label: "PresentUnits" },
      { key: "missingUnitCount", label: "MissingUnits" },
      { key: "lastMissingAt", label: "LastMissingAt" },
    ]);
  }

  if (view === "diff") {
    return renderTextTable(payload, [
      { key: "scope", label: "Scope" },
      { key: "type", label: "Type" },
      { key: "target", label: "Target" },
      { key: "previous", label: "Previous" },
      { key: "current", label: "Current" },
      { key: "summary", label: "Summary" },
    ]);
  }

  if (view === "conflicts") {
    return renderTextTable(payload, [
      { key: "conflictId", label: "Conflict" },
      { key: "status", label: "Status" },
      { key: "chosenStableKey", label: "Chosen" },
      { key: "count", label: "Count" },
      { key: "lastSeenAt", label: "LastSeenAt" },
      { key: "summary", label: "Summary" },
    ]);
  }

  return renderTextTable(payload, [
    { key: "at", label: "At" },
    { key: "scope", label: "Scope" },
    { key: "type", label: "Type" },
    { key: "target", label: "Target" },
    { key: "summary", label: "Summary" },
  ]);
}

export async function runQuery(args) {
  const inventory = await readJson(inventoryPath, { generatedAt: null, units: [] });
  const history = await readJson(historyPath, { generatedAt: null, units: [], families: [], conflicts: [] });
  const discoveryRuns = await readJson(discoveryRunsPath, { generatedAt: null, runs: [] });

  let items;
  let metadata = {};
  if (args.view === "units") {
    items = filterUnits((history.units ?? []).map(mapUnit), args)
      .sort((left, right) => String(left.stableKey).localeCompare(String(right.stableKey)))
      .slice(0, args.limit);
  } else if (args.view === "families") {
    items = filterFamilies((history.families ?? []).map(mapFamily), args)
      .sort((left, right) => String(left.familyKey).localeCompare(String(right.familyKey)))
      .slice(0, args.limit);
  } else if (args.view === "changes") {
    items = buildChangeEntries(history).slice(0, args.limit);
  } else if (args.view === "diff") {
    const runs = discoveryRuns.runs ?? [];
    const currentRun = runs.at(-1) ?? null;
    const previousRun = runs.at(-2) ?? null;
    items = buildDiffEntries(previousRun, currentRun).slice(0, args.limit);
    metadata = {
      previousRunAt: previousRun?.generatedAt ?? null,
      currentRunAt: currentRun?.generatedAt ?? null,
      previousRunId: previousRun?.runId ?? null,
      currentRunId: currentRun?.runId ?? null,
    };
  } else if (args.view === "conflicts") {
    items = (history.conflicts ?? [])
      .map(mapConflict)
      .sort((left, right) => String(right.lastSeenAt ?? "").localeCompare(String(left.lastSeenAt ?? "")))
      .slice(0, args.limit);
  } else {
    throw new Error(`Unsupported --view '${args.view}'. Use units, families, changes, diff, or conflicts.`);
  }

  return {
    generatedAt: history.generatedAt ?? inventory.generatedAt ?? discoveryRuns.generatedAt ?? null,
    view: args.view,
    ...metadata,
    items,
  };
}
