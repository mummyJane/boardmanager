# Board Manager Milestone Plan

Last updated: 2026-03-29 11:40 Europe/London

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
