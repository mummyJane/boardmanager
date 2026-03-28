# Context

Last updated: 2026-03-28 14:52 Europe/London

## Project Intent

Board Manager is a new project intended to manage hardware boards based on ESP32 and STM32 MCUs. The first need is a clean source-of-truth representation of boards and IO. That metadata must drive generated firmware integration layers. Later the platform will discover boards over USB, store board inventory in a database, and manage build/program/debug workflows through a web interface.

## Repository State

- repository now has an origin remote at `https://github.com/mummyJane/boardmanager.git`
- required `notes/codex` files are in place and being maintained
- sample board definitions exist for generic ESP32 and STM32 targets plus a concrete M5Stack Dial V1.1 profile
- generated C headers and source stubs are produced under `project/generated`

## Initial Architecture Direction

- machine-readable board definitions in `project/boards`
- generation script in `project/scripts`
- generated C artifacts in `project/generated`
- shared firmware-facing types and function contracts in `project/firmware-common`
- reserved folders for future web and device-manager services

## Concrete Board Knowledge Captured

- M5Stack Dial V1.1 modeled as an ESP32-S3 based board using the M5StampS3 module
- board profile includes key power, display, touch, RFID, encoder, I2C, SPI, and expansion port mappings
