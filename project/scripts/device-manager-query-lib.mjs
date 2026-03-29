import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const inventoryPath = path.join(projectRoot, "device-manager", "data", "inventory.json");
const historyPath = path.join(projectRoot, "device-manager", "data", "unit-history.json");

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

function mapUnit(unit) {
  return {
    stableKey: unit.stableKey,
    boardId: unit.boardIds?.[unit.boardIds.length - 1] ?? null,
    familyKey: unit.familyKey,
    present: unit.present !== false,
    presentPort: unit.present !== false ? unit.lastTransport?.port ?? null : null,
    lastSeenAt: unit.lastSeenAt ?? null,
    lastPresentAt: unit.lastPresentAt ?? null,
    lastMissingAt: unit.lastMissingAt ?? null,
    seenCount: unit.seenCount ?? 0,
    missingCount: unit.missingCount ?? 0,
    firmwareApp: unit.observed?.firmwareApps?.[unit.observed.firmwareApps.length - 1] ?? null,
    firmwareVersion: unit.observed?.firmwareVersions?.[unit.observed.firmwareVersions.length - 1] ?? null,
    owner: unit.annotation?.owner ?? null,
    location: unit.annotation?.location ?? null,
    purpose: unit.annotation?.purpose ?? null,
    label: pickLabel(unit),
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
  const history = await readJson(historyPath, { generatedAt: null, units: [], families: [] });

  let items;
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
  } else {
    throw new Error(`Unsupported --view '${args.view}'. Use units, families, or changes.`);
  }

  return {
    generatedAt: history.generatedAt ?? inventory.generatedAt ?? null,
    view: args.view,
    items,
  };
}
