# Device Manager

This folder now contains the first Milestone 2 discovery slice.

## Scope

- scan currently attached units on the local host
- capture transport and USB identity details
- capture stable identifiers such as USB instance path, MAC, and serial-like values where available
- capture ESP32 short firmware signatures where possible
- match observations back to known board definitions from Stage 1
- preserve per-unit history across discovery runs
- record when previously known units are currently missing without deleting their history
- recognize when a newly seen physical unit belongs to a previously seen board family
- start a draft profile for genuinely new board families
- allow operator-assigned labels and notes per physical unit
- track ownership, location, and purpose changes in the unit history layer
- persist the current discovery snapshot in simple local data files
- persist a compact discovery-run ledger so the latest two scans can be diffed quickly
- export stable JSON reports for the current bench and cumulative history
- synchronize the persisted Stage 2 model into a normalized SQLite database

## Current Files

- `schema/device-inventory.schema.json`: JSON schema for the latest discovery snapshot
- `schema/unit-history.schema.json`: JSON schema for persisted unit and family history
- `schema/family-profile.schema.json`: JSON schema for generated family profile stubs
- `schema/unit-annotations.schema.json`: JSON schema for operator-assigned unit labels and notes
- `schema/discovery-runs.schema.json`: JSON schema for the compact discovery-run ledger
- `schema/device-manager.sqlite.sql`: SQLite schema for the normalized Stage 2 store
- `data/inventory.json`: latest local discovery snapshot
- `data/unit-history.json`: cumulative unit and family history
- `data/unit-annotations.json`: operator-assigned labels, notes, and ownership metadata keyed by stable unit id
- `data/discovery-runs.json`: compact per-run snapshots used for the latest-two-run diff view
- `data/device-manager.sqlite`: normalized SQLite database synchronized from the persisted Stage 2 JSON model
- `profiles/*.json`: draft or known family profile files enriched with likely Stage 1 board candidates
- `reports/current-bench-report.json`: exportable snapshot of the current bench state
- `reports/unit-history-report.json`: exportable cumulative history report
- `reports/report-manifest.json`: manifest for the generated report set

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

The unit history also preserves cumulative metadata history for operator-assigned owner, location, and purpose values so bench-role changes can be tracked over time. It now records whether a unit or family is currently present, plus transition summaries for first seen, last seen, last present, and last missing state changes.

## Operator Labels

Use `annotate-unit.ps1` to attach operator-facing metadata to a stable unit id.

Example:

`./annotate-unit.ps1 -Unit "mac:c0:4e:30:13:2b:68" -Label "Dial Left" -Location "Bench A" -Purpose "UI test unit" -Note "Keep on smoke-test firmware"`

That annotation is merged into both the latest inventory and the cumulative unit history on the next discovery run. Ownership, location, and purpose values are also appended into the unit metadata history immediately when the annotation command runs.

## Query Access

Use `query.ps1` as the first shared query layer for operators, the future web UI, and remote callers.

Examples:

- `./query.ps1 -View units`
- `./query.ps1 -View families -Format json`
- `./query.ps1 -View changes -Limit 10`
- `./query.ps1 -View diff -Format json`

The JSON output is the stable machine-facing form. The PowerShell wrapper is only the local host entry point.

## Diff View

The diff view compares the latest two discovery runs from `data/discovery-runs.json`.

Current diff coverage:

- added or removed units
- per-unit port changes
- per-unit firmware identity changes
- added or removed families
- family present-unit count changes

Use a controlled discovery pass, such as temporarily ignoring a known port, when you want the diff to capture a removal or restore event on demand.

## SQLite Sync

Use `sync-device-manager-db.ps1` to rebuild the normalized SQLite database at `project/device-manager/data/device-manager.sqlite` from the persisted JSON sources.

This sync is also run automatically by `discover.ps1` and `annotate-unit.ps1` so the database stays aligned with the current discovery model.`r`n`r`n## Validation`r`n`r`nUse `validate.ps1` to validate both the board-definition model and the persisted device-manager data files.`r`n`r`nCurrent device-manager validation covers:`r`n`r`n- `data/inventory.json``r`n- `data/unit-history.json``r`n- `data/unit-annotations.json``r`n- `data/discovery-runs.json``r`n- `profiles/*.json`

## Report Export

Use `export-reports.ps1` to write stable JSON report files under `project/device-manager/reports`.

Files currently exported:

- `current-bench-report.json`
- `unit-history-report.json`
- `report-manifest.json`

## Service Access

Use `serve-device-manager.ps1` to expose the same shared query contract over HTTP for the future web UI and remote callers.

Endpoints:

- `GET /health`
- `GET /api/query?view=units`
- `GET /api/query?view=families`
- `GET /api/query?view=changes&limit=10`
- `GET /api/query?view=diff`

Example:

- `./serve-device-manager.ps1 -BindHost 127.0.0.1 -Port 8787`



## Conflict View

- `query.ps1 -View conflicts` shows persisted identity-evidence conflicts where one observation matched multiple prior units.
- The same data is exposed over HTTP at `/api/query?view=conflicts`.
- Conflict records stay in `project/device-manager/data/unit-history.json` and are synchronized into SQLite for later UI and operator workflows.
