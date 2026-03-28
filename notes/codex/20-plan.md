# Board Manager Milestone Plan

Last updated: 2026-03-28 14:30 Europe/London

## Milestone 1: Repository Bootstrap And Board Definition Pipeline

Objective:
Create the initial repository structure, documentation baseline, sample board definitions, and generated firmware interface artifacts.

Success criteria:

- repository contains required `notes/codex` tracking files
- board definition schema is documented and represented by sample JSON files
- a generator produces deterministic C header/source artifacts
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
