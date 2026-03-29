# Board Manager Spec

Last updated: 2026-03-29 09:19 Europe/London

## Goal

Create a Board Manager platform that can define supported boards, expose a stable firmware control API, identify boards connected over USB, track them in a database, and drive build/program/debug workflows from a web interface.

## Scope By Stage

### Stage 1: Board Definition And Firmware Interface

Deliverables:

- a canonical machine-readable board definition format
- support for ESP32 and STM32 MCU families
- reusable part definitions for MCU dies, packages, modules, and attached devices
- board assembly definitions that bind reusable parts into concrete boards
- grouped bus and connector definitions for complex boards
- generated board headers and source stubs for firmware projects
- generated board boot/setup sequences that initialize controller, buses, devices, and board-level signals in order
- local project-managed SDK and toolchain layout under `project/`
- top-level build, clean, and program scripts that self-manage environment setup
- a shared firmware API layer that higher-level code can call without depending on raw pin numbers

Requirements:

- board definitions must include board id, display name, revision, supported transport capabilities, and references to reusable part definitions
- reusable part definitions must capture stable metadata for MCU families, packages, modules, peripherals, and external devices so they can be shared across boards
- reusable parts own the init/setup contract, smoke-test contract, and reusable high-level API shape for that part class; boards only bind and configure instances of those parts
- each board control or status signal must define board-level semantic name, direction, logical function, and its mapping through module/package/MCU signals
- definitions must be able to describe board buses such as I2C and SPI plus exposed connectors and expansion ports
- project-level configuration must be able to override or extend reusable part settings for a specific board or firmware target
- board definitions must be able to declare boot/setup order so the generated board init function can call controller, bus, device, and signal setup in sequence
- ESP32-family targets use `esp-idf` as the chip-level SDK; STM32-family targets use `stm32cube`
- all project-managed SDKs, toolchains, downloads, and build outputs must live under `project/`
- build/clean/program entry scripts must require no pre-sourced environment and must restore any temporary environment changes when they exit
- host-side build validation must be possible without connected hardware; STM32 validation may use a local STM32Cube firmware package plus a local Arm bare-metal compiler toolchain
- programming scripts must accept the specific unit or port to target because multiple units may be connected at once
- the build system is CMake, including SDK-backed flows such as `esp-idf`
- generated code must not contain parent-directory include paths; include resolution is owned by the build system
- generator output must be deterministic so generated firmware artifacts can be committed and reviewed
- generated APIs must expose initialization and one function per named output or readable input where applicable
- board demos and diagnostics must be able to run non-fatal smoke tests so present or failing peripherals can be reported without crashing the whole board bring-up
- generated boot and signal APIs must delegate through a stable board-level hook layer so concrete `esp-idf` and `stm32cube` implementations can live outside generated files
- the schema must be extensible for buses, analog channels, interrupts, and board variants

### Stage 2: Board Discovery And Database

Deliverables:

- USB discovery service for connected units and boards
- a normalized database for board inventory, parts, and capabilities
- persistence for board definitions, observed hardware, firmware versions, and ownership history
- initial APIs for querying connected boards and known inventory

Requirements:

- the service must identify a board through VID/PID, serial number, USB descriptors, chip MAC, bootloader signatures, observed current-firmware signatures, or a board agent running on the target
- the system must support multiple connected units at once
- discovery records must preserve the target port and any observed hardware or firmware fingerprints so later build and flash actions can address one unit without ambiguity
- discovery data must link back to the board definition model from Stage 1

### Stage 3: Build, Program, And Debug

Deliverables:

- build orchestration per board family
- flashing workflows for ESP32 and STM32
- debug session launch support
- job status APIs for the web interface

Requirements:

- build definitions must be tied to a board profile and firmware target
- programming tools must be pluggable by MCU family
- debug support must capture enough metadata to reproduce the session

### Stage 4: Web Interface

Deliverables:

- browser-based dashboard
- board inventory view
- board definition browser
- build/flash/debug job controls
- status, logs, and recent activity views

Requirements:

- UI must talk to a service layer, not directly to firmware tools
- UI must be able to inspect board assemblies, IO definitions, bus layouts, boot order, generated API surface, and per-part help/man pages including datasheet, website, and API usage references

## Non-Goals For Initial Milestone

- production-ready USB probing
- finished database schema and migrations
- production authentication
- final firmware HAL implementations for every MCU family

## Initial Technical Direction

- use JSON as the first board and part definition format for easy tooling and review
- use Node.js scripts with no third-party dependencies for initial artifact generation
- generate C headers and C source stubs as the firmware integration point
- keep web and host tooling modular so later milestones can evolve independently






