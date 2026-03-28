# Board Manager Milestone Plan

Last updated: 2026-03-28 15:22 Europe/London

## Milestone 1: Repository Bootstrap And Board Definition Pipeline

Objective:
Create the initial repository structure, documentation baseline, reusable part catalog, sample board assemblies, generated firmware interface artifacts, and generated boot/setup sequencing.

Success criteria:

- repository contains required `notes/codex` tracking files
- reusable part definitions exist for MCU, package, module, and attached devices
- board assembly schema is documented and represented by sample JSON files
- generator resolves board assemblies into deterministic C header/source artifacts
- generated board init code reflects declared boot order for controller, buses, devices, and signal states
- install and update scripts exist for the milestone

## Future Milestones

### Milestone 2: USB Discovery And Inventory Model

- define host-side service boundaries
- create initial database schema
- add USB probing abstraction

### Milestone 3: Build/Flash/Debug Orchestration

- define toolchain adapters
- define job execution model
- add board-to-toolchain mapping

### Milestone 4: Web UI Skeleton

- scaffold dashboard app
- add inventory and board definition views
- wire to service APIs
