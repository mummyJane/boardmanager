# Device Manager

This folder now contains the first Milestone 2 discovery slice.

## Scope

- scan currently attached units on the local host
- capture transport and USB identity details
- capture stable identifiers such as USB instance path, MAC, and serial-like values where available
- capture ESP32 short firmware signatures where possible
- match observations back to known board definitions from Stage 1
- preserve per-unit history across discovery runs
- recognize when a newly seen physical unit belongs to a previously seen board family
- start a draft profile for genuinely new board families
- allow operator-assigned labels and notes per physical unit
- persist the current discovery snapshot in simple local data files

## Current Files

- `schema/device-inventory.schema.json`: JSON schema for the latest discovery snapshot
- `schema/unit-history.schema.json`: JSON schema for persisted unit and family history
- `schema/family-profile.schema.json`: JSON schema for generated family profile stubs
- `schema/unit-annotations.schema.json`: JSON schema for operator-assigned unit labels and notes
- `data/inventory.json`: latest local discovery snapshot
- `data/unit-history.json`: cumulative unit and family history
- `data/unit-annotations.json`: operator-assigned labels, notes, and ownership metadata keyed by stable unit id
- `profiles/*.json`: draft or known family profile files enriched with likely Stage 1 board candidates

The first pass is intentionally local and Windows-focused. It is designed to give the future service and database layers a stable observation format before introducing a daemon or web API.

## Identity Rules

The inventory must preserve enough identity information to distinguish same-model units from one another.

Current priority order for the stable unit key is:

1. chip MAC, if available
2. USB instance path
3. serial number, if a future probe provides one
4. current transport port as a temporary fallback only

This allows two physically attached Dial units to remain distinct even though they map to the same board definition.

## History Rules

When a unit is discovered, the manager should classify it in this order:

1. known unit: the same physical unit was seen before by stable identity
2. known family: the physical unit is new, but its board family or hardware fingerprint matches a previously seen card type
3. new family: neither the unit nor its card family has been seen before, so the system starts a draft family profile

This lets discovery distinguish between "the same board again", "another board of a known type", and "something genuinely new on the bench".

## Operator Labels

Use `annotate-unit.ps1` to attach operator-facing metadata to a stable unit id.

Example:

`./annotate-unit.ps1 -Unit "mac:c0:4e:30:13:2b:68" -Label "Dial Left" -Location "Bench A" -Purpose "UI test unit" -Note "Keep on smoke-test firmware"`

That annotation is merged into both the latest inventory and the cumulative unit history on the next discovery run.
