# Context

Last updated: 2026-03-28 14:35 Europe/London

## Project Intent

Board Manager is a new project intended to manage hardware boards based on ESP32 and STM32 MCUs. The first need is a clean source-of-truth representation of boards and IO. That metadata must drive generated firmware integration layers. Later the platform will discover boards over USB, store board inventory in a database, and manage build/program/debug workflows through a web interface.

## Repository State

- repository was initially empty except for `AGENTS.md`
- required `notes/codex` files were missing and have now been created
- sample board definitions exist for one ESP32 board and one STM32 board
- generated C headers and source stubs are produced under `project/generated`

## Initial Architecture Direction

- machine-readable board definitions in `project/boards`
- generation script in `project/scripts`
- generated C artifacts in `project/generated`
- shared firmware-facing types and function contracts in `project/firmware-common`
- reserved folders for future web and device-manager services
