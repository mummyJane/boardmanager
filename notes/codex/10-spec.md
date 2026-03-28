# Board Manager Spec

Last updated: 2026-03-28 14:48 Europe/London

## Goal

Create a Board Manager platform that can define supported boards, expose a stable firmware control API, identify boards connected over USB, track them in a database, and drive build/program/debug workflows from a web interface.

## Scope By Stage

### Stage 1: Board Definition And Firmware Interface

Deliverables:

- a canonical machine-readable board definition format
- support for ESP32 and STM32 MCU families
- IO definitions that map board functions to MCU pins and peripherals
- grouped bus and connector definitions for complex boards
- generated board headers and source stubs for firmware projects
- a shared firmware API layer that higher-level code can call without depending on raw pin numbers

Requirements:

- board definitions must include board id, display name, MCU family, MCU part number, revision, and supported transport capabilities
- each control or status signal must define board-level semantic name, direction, logical function, MCU signal name, MCU pin, and optional peripheral binding
- definitions must be able to describe board buses such as I2C and SPI plus exposed connectors and expansion ports
- generator output must be deterministic so generated firmware artifacts can be committed and reviewed
- generated APIs must expose initialization and one function per named output or readable input where applicable
- the schema must be extensible for buses, analog channels, interrupts, and board variants

### Stage 2: Board Discovery And Database

Deliverables:

- USB discovery service for connected units and boards
- a normalized database for board inventory and capabilities
- persistence for board definitions, observed hardware, firmware versions, and ownership history
- initial APIs for querying connected boards and known inventory

Requirements:

- the service must identify a board through VID/PID, serial number, USB descriptors, bootloader signatures, or a board agent running on the target
- the system must support multiple connected units at once
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
- UI must be able to inspect board IO definitions, bus layouts, and generated API surface

## Non-Goals For Initial Milestone

- production-ready USB probing
- finished database schema and migrations
- production authentication
- final firmware HAL implementations for every MCU family

## Initial Technical Direction

- use JSON as the first board definition format for easy tooling and review
- use Node.js scripts with no third-party dependencies for initial artifact generation
- generate C headers and C source stubs as the firmware integration point
- keep web and host tooling modular so later milestones can evolve independently
