# Board Manager Milestone Plan

Last updated: 2026-03-29 17:13 Europe/London

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
Started on 2026-03-29 with a Windows discovery script, persisted inventory schema, and a first matched scan of the current four-unit bench.

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
- discovery persists firmware app id, version, build id, and self-reported board id per unit where firmware exposes them
- unit history preserves cumulative owner, location, and purpose changes for each stable unit id
- discovery preserves known units that are missing from the latest scan and records their missing state
- the unit and family model preserve transition summaries for first-seen, last-seen, last-present, and last-missing state changes
- the model reserves a per-unit security binding for an AES key and an asymmetric keypair stored under `keys/``r`n- the first query layer is reusable by operators now and by the future web UI and remote systems later`r`n- the first HTTP service endpoint exposes that same query contract for local and remote consumers

## Future Milestones

### Milestone 3: Build/Flash/Debug Orchestration

- define toolchain adapters
- define job execution model
- add board-to-toolchain mapping

### Milestone 4: Web UI Skeleton

- scaffold dashboard app
- add inventory and board definition views
- wire to service APIs


