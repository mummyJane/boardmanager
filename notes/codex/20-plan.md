# Board Manager Milestone Plan

Last updated: 2026-03-29 21:40 Europe/London

## Milestone 1: Repository Bootstrap And Board Definition Pipeline

Objective:
Create the initial repository structure, documentation baseline, reusable part catalog, concrete board assemblies, generated firmware interface artifacts, generated boot/setup sequencing, local-tooling bootstrap for Windows, and real demo/build coverage for the currently attached ESP32 and STM32 boards.

Status:
Completed on 2026-03-29 after validating real ESP32 bring-up on the attached Dial and CoreS3 boards plus host-side STM32 builds for the sample F4 board and the attached F072 board.

Success criteria:

- repository contains required `notes/codex` tracking files
- reusable part definitions exist for MCU, package, module, and attached devices
- board assembly schema is documented and represented by sample JSON files
- generator resolves board assemblies into deterministic C header/source artifacts
- generated board init code reflects declared boot order for controller, buses, devices, and signal states
- local SDK and toolchain layout exists under `project/`
- top-level scripts can install tools, build, clean, and program without pre-sourced env setup
- ESP32 build and flash validation passes using the local SDK layout
- STM32 host-side build validation passes for the supported sample and attached boards
- install and update scripts exist for the milestone

## Milestone 2: USB Discovery And Inventory Model

Objective:
Add a local host-side discovery flow that fingerprints connected units, matches them back to Stage 1 board definitions, and persists an inventory snapshot for later service and database work.

Status:
In progress on 2026-03-29 with persisted discovery, history, query, service, reports, SQLite sync, key management, board-agent capture, registry-backed STM32 matching, and live profiling of an additional unknown ESP32-class unit on COM7.

Initial success criteria:

- discovery output has a stable persisted schema
- current connected units can be scanned from the local host
- observations capture port, USB identity, and firmware or chip signatures where possible
- identical board models remain distinguishable through stable unit identity keys based on MAC, USB instance, serial number, or alias history
- discovery records match back to known board definitions
- the latest snapshot is persisted under `project/device-manager`
- cumulative unit and family history is persisted across discovery runs
- a newly seen physical unit can fall back to a previously seen family match before being treated as a brand-new card type
- discovery starts a draft family profile when it encounters a genuinely new card family
- family profiles are enriched with exact board metadata or likely board candidates from the Stage 1 board catalog
- operators can assign stable labels and notes to physical units without depending on the current COM port
- discovery persists firmware app id, version, build id, and self-reported board id per unit where firmware exposes it
- firmware board-agent handshakes expose self-reported capability sets that flow into discovery, history, query, and SQLite persistence
- unit history preserves cumulative owner, location, and purpose changes for each stable unit id
- discovery preserves known units that are missing from the latest scan and records their missing state
- the unit and family model preserve transition summaries for first-seen, last-seen, last-present, and last-missing state changes
- the model reserves a per-unit security binding for an AES key and an asymmetric keypair stored under `keys/`
- the first query layer is reusable by operators now and by the future web UI and remote systems later
- the first HTTP service endpoint exposes that same query contract for local and remote consumers
- discovery persists a compact run ledger and can diff the latest two runs for added, removed, or changed units and families`n- operators can export the current bench snapshot and cumulative history as stable JSON report files under project/device-manager/reports`r`n- discovery and annotation flows synchronize the persisted Stage 2 model into project/device-manager/data/device-manager.sqlite for normalized table access`r`n- the standard validation flow also checks device-manager data files and family profiles against their schemas`r`n- local key-management tooling now maintains a root signer plus per-unit AES and identity keys under keys/ for the currently attached units
- STM32-family matching uses registry-backed USB identity fields instead of only STLink transport naming
- known USB-to-UART bridges can be probed non-destructively for MCU identity so unknown ESP-class boards can be promoted to MAC-based units and richer draft profiles
- the current unknown COM7 board is promoted from a generic CP210x bridge record to an ESP32-based draft family with captured MAC, chip, flash size, and boot-banner evidence
- discovery now records parsed USB topology summaries from Windows location information, including path-style summaries for the native USB boards and hub/port summaries for bridged boards such as COM7
- discovery now persists richer USB descriptor identity fields including product name, revision, driver key, and hardware-id derived revision data for the current bench devices

## Future Milestones

### Milestone 3: Build/Flash/Debug Orchestration

- define toolchain adapters
- define job execution model
- add board-to-toolchain mapping

### Milestone 4: Web UI Skeleton

- scaffold dashboard app
- add inventory and board definition views
- wire to service APIs





- 2026-03-29 19:50 Europe/London: Completed identity-upgrade reconciliation so transport-only unit history collapses into stronger MAC-backed identity records instead of leaving split history.

- 2026-03-29 20:08 Europe/London: Completed conflict handling for disagreeing identity evidence, with persisted conflict ledger entries, query support, and SQLite sync for later UI and operator workflows.

- 2026-03-29 20:22 Europe/London: Completed manual override support for pinning units to board or family identities, with clearable persistent overrides merged into discovery and query output.

- 2026-03-29 20:45 Europe/London: Completed draft family reconciliation tooling with a dry-run-first operator flow that can promote a draft profile into a known board profile while preserving merge provenance on the source profile.


- 2026-03-29 21:05 Europe/London: Completed retention rules for Stage 2 by capping discovery-run history and rolling observed arrays, with the retention pass wired into discover.ps1 before SQLite sync.


- 2026-03-29 21:20 Europe/London: Completed basic service-layer APIs with direct JSON endpoints for inventory, history, and profiles on top of the existing query service.


- 2026-03-29 21:40 Europe/London: Completed Stage 2 test coverage with a local dependency-free Node assertion runner for discovery matching, history transitions, board-candidate enrichment, and service-data filtering.

