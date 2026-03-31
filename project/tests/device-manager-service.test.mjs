import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getInventoryPayload, getHistoryPayload, getProfilesPayload } from "../scripts/device-manager-service-data.mjs";

function params(entries) {
  return new URLSearchParams(entries);
}

export async function runServiceTests() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "boardmanager-service-tests-"));
  const dataRoot = path.join(tempRoot, "data");
  const profilesRoot = path.join(tempRoot, "profiles");

  try {
    await mkdir(dataRoot, { recursive: true });
    await mkdir(profilesRoot, { recursive: true });

    await writeFile(path.join(dataRoot, "inventory.json"), `${JSON.stringify({
      generatedAt: "2026-03-31T08:20:00.000Z",
      host: { name: "fixture-host" },
      units: [
        { unitId: "mac:fixture:1", identity: { stableKey: "mac:fixture:1" }, present: true },
        { unitId: "mac:fixture:2", identity: { stableKey: "mac:fixture:2" }, present: false },
      ],
    }, null, 2)}\n`, "utf8");

    await writeFile(path.join(dataRoot, "unit-history.json"), `${JSON.stringify({
      generatedAt: "2026-03-31T08:20:00.000Z",
      host: { name: "fixture-host" },
      units: [
        { stableKey: "mac:fixture:1", familyKey: "board:fixture_board", present: true },
        { stableKey: "mac:fixture:2", familyKey: "board:fixture_board", present: false },
      ],
      families: [
        { familyKey: "board:fixture_board", present: true },
        { familyKey: "board:missing_board", present: false },
      ],
      conflicts: [
        { conflictId: "conflict-open", status: "open" },
        { conflictId: "conflict-resolved", status: "resolved" },
      ],
    }, null, 2)}\n`, "utf8");

    await writeFile(path.join(profilesRoot, "draft_profile.json"), `${JSON.stringify({
      profileId: "draft_profile",
      familyKey: "unknown:fixture",
      status: "draft",
      resolvedBoardId: null,
    }, null, 2)}\n`, "utf8");
    await writeFile(path.join(profilesRoot, "resolved_profile.json"), `${JSON.stringify({
      profileId: "resolved_profile",
      familyKey: "board:fixture_board",
      status: "resolved",
      resolvedBoardId: "fixture_board",
    }, null, 2)}\n`, "utf8");

    const options = {
      dataRoot,
      profilesRoot,
      generatedAt: "2026-03-31T08:21:00.000Z",
    };

    const inventoryPayload = await getInventoryPayload(params([["unit", "mac:fixture:1"]]), options);
    assert.equal(inventoryPayload.unitCount, 1);
    assert.equal(inventoryPayload.units[0].identity.stableKey, "mac:fixture:1");

    const historyPayload = await getHistoryPayload(params([["family", "board:fixture_board"], ["includeMissing", "false"]]), options);
    assert.equal(historyPayload.familyCount, 1);
    assert.equal(historyPayload.unitCount, 1);
    assert.equal(historyPayload.families[0].familyKey, "board:fixture_board");
    assert.equal(historyPayload.conflictCount, 1);

    const profilesPayload = await getProfilesPayload(params([["status", "draft"], ["unresolvedOnly", "true"]]), options);
    assert.equal(profilesPayload.generatedAt, "2026-03-31T08:21:00.000Z");
    assert.equal(profilesPayload.profileCount, 1);
    assert.equal(profilesPayload.profiles[0].profileId, "draft_profile");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
