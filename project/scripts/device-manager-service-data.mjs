import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const deviceManagerRoot = path.join(projectRoot, "device-manager");
const dataRoot = path.join(deviceManagerRoot, "data");
const profilesRoot = path.join(deviceManagerRoot, "profiles");

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function readInventory() {
  return readJson(path.join(dataRoot, "inventory.json"), { generatedAt: null, host: {}, units: [] });
}

export async function readHistory() {
  return readJson(path.join(dataRoot, "unit-history.json"), { generatedAt: null, host: {}, units: [], families: [], conflicts: [] });
}

export async function readProfiles() {
  const entries = await readdir(profilesRoot, { withFileTypes: true });
  const profiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(profilesRoot, entry.name);
    const profile = await readJson(filePath, null);
    if (profile) profiles.push(profile);
  }
  return profiles.sort((left, right) => String(left.profileId).localeCompare(String(right.profileId)));
}

function parseBoolean(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue;
  return ["1", "true", "yes"].includes(String(value).toLowerCase());
}

export async function getInventoryPayload(searchParams) {
  const inventory = await readInventory();
  const unit = searchParams.get("unit");
  const units = (inventory.units ?? []).filter((entry) => !unit || entry.unitId === unit || entry.identity?.stableKey === unit);
  return {
    generatedAt: inventory.generatedAt ?? null,
    host: inventory.host ?? {},
    unitCount: units.length,
    units,
  };
}

export async function getHistoryPayload(searchParams) {
  const history = await readHistory();
  const unit = searchParams.get("unit");
  const family = searchParams.get("family");
  const includeMissing = parseBoolean(searchParams.get("includeMissing"), true);

  const units = (history.units ?? []).filter((entry) => {
    if (unit && entry.stableKey !== unit) return false;
    if (family && entry.familyKey !== family) return false;
    if (!includeMissing && entry.present === false) return false;
    return true;
  });

  const families = (history.families ?? []).filter((entry) => {
    if (family && entry.familyKey !== family) return false;
    if (!includeMissing && entry.present === false) return false;
    return true;
  });

  const conflicts = (history.conflicts ?? []).filter((entry) => includeMissing || entry.status !== "resolved");

  return {
    generatedAt: history.generatedAt ?? null,
    host: history.host ?? {},
    unitCount: units.length,
    familyCount: families.length,
    conflictCount: conflicts.length,
    units,
    families,
    conflicts,
  };
}

export async function getProfilesPayload(searchParams) {
  const profiles = await readProfiles();
  const profileId = searchParams.get("profile");
  const familyKey = searchParams.get("family");
  const status = searchParams.get("status");
  const unresolvedOnly = parseBoolean(searchParams.get("unresolvedOnly"), false);

  const items = profiles.filter((entry) => {
    if (profileId && entry.profileId !== profileId) return false;
    if (familyKey && entry.familyKey !== familyKey) return false;
    if (status && entry.status !== status) return false;
    if (unresolvedOnly && entry.resolvedBoardId) return false;
    return true;
  });

  return {
    generatedAt: new Date().toISOString(),
    profileCount: items.length,
    profiles: items,
  };
}
