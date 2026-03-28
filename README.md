# Board Manager

Board Manager is a staged project for managing ESP32- and STM32-based boards from a web interface.

The project starts with a source-of-truth board definition format that captures:

- board identity and MCU family
- IO channels and board-level naming
- pin mappings back to MCU peripherals and pads
- generated firmware headers and API stubs

Later milestones add:

- USB board identification and inventory management
- a board database and configuration history
- build, flash, and debug workflows
- a web UI for board discovery, status, and control

## Repository Layout

- `project/boards`: JSON board definitions
- `project/scripts`: generation and validation scripts
- `project/generated`: generated firmware headers and C sources
- `project/firmware-common`: shared firmware-facing API headers
- `project/device-manager`: future host-side USB and database service
- `project/web`: future web UI
- `install`: milestone install scripts
- `update`: milestone update scripts
- `notes/codex`: spec, plan, tasks, context, work log, and decisions

## First Milestone

The current milestone establishes the metadata model and generation path for board definitions.

Run:

```powershell
node project/scripts/generate-board-artifacts.mjs
```

This reads the sample board definitions and writes generated files into `project/generated`.
