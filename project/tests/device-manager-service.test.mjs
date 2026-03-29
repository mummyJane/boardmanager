import assert from "node:assert/strict";
import { getInventoryPayload, getHistoryPayload, getProfilesPayload } from "../scripts/device-manager-service-data.mjs";

function params(entries) {
  return new URLSearchParams(entries);
}

export async function runServiceTests() {
  const inventoryPayload = await getInventoryPayload(params([["unit", "mac:c8:2e:18:f0:47:74"]]));
  assert.equal(inventoryPayload.unitCount, 1);
  assert.equal(inventoryPayload.units[0].identity.stableKey, "mac:c8:2e:18:f0:47:74");

  const historyPayload = await getHistoryPayload(params([["family", "board:m5stack_dial_v1_1"], ["includeMissing", "false"]]));
  assert.equal(historyPayload.familyCount, 1);
  assert.equal(historyPayload.unitCount, 2);
  assert.equal(historyPayload.families[0].familyKey, "board:m5stack_dial_v1_1");

  const profilesPayload = await getProfilesPayload(params([["status", "draft"], ["unresolvedOnly", "true"]]));
  assert.ok(profilesPayload.profileCount >= 1);
  assert.ok(profilesPayload.profiles.every((entry) => entry.status === "draft"));
  assert.ok(profilesPayload.profiles.every((entry) => !entry.resolvedBoardId));
}
