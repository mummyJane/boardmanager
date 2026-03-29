# Board Manager Spec

Last updated: 2026-03-29 18:00 Europe/London

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
- local help/man pages for active reusable parts and concrete boards

Requirements:

- board definitions must include board id, display name, revision, supported transport capabilities, and references to reusable part definitions
- reusable part definitions must capture stable metadata for MCU families, packages, modules, peripherals, and external devices so they can be shared across boards
- reusable parts own the init/setup contract, smoke-test contract, reusable high-level API shape, and help/man references for that part class; boards only bind and configure instances of those parts
- each board control or status signal must define board-level semantic name, direction, logical function, and its mapping through module/package/MCU signals
- definitions must be able to describe board buses such as I2C and SPI plus exposed connectors and expansion ports
- project-level configuration must be able to override or extend reusable part settings for a specific board or firmware target
- board definitions must be able to declare boot/setup order so the generated board init function can call controller, bus, device, and signal setup in sequence
- stacked or attached accessory modules may be represented as concrete board assemblies until the schema gains first-class nested subassembly support
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
- a host-side query layer that can be reused by the future web interface and by remote callers from another system
- a first local or remote service endpoint that exposes the shared query contract over HTTP
- a persisted discovery-run ledger and a diff view over the latest two runs`n- exportable JSON reports for the current bench inventory and cumulative unit history

Requirements:

- the service must identify a board through VID/PID, serial number, USB descriptors, chip MAC, bootloader signatures, observed current-firmware signatures, or a board agent running on the target
- the system must support multiple connected units at once
- discovery records must preserve the target port and any observed hardware or firmware fingerprints so later build and flash actions can address one unit without ambiguity
- discovery records must persist stable per-unit identity fields such as chip MAC, USB instance path, serial number, and alias history so identical boards can be distinguished from one another across replug events
- discovery data must link back to the board definition model from Stage 1
- discovery must preserve cumulative per-unit history with first-seen, last-seen, seen-count, prior aliases, and observed firmware or hardware fingerprints
- discovery must preserve units that are currently unplugged or missing from the latest scan instead of deleting them from history, and must record that missing state per unit
- the persisted unit and family model must expose transition summaries for first seen, last seen, last present, and last missing state changes
- Stage 2 should expose a stable query contract over the persisted inventory and history so later Milestone 4 UI work and remote systems can consume the same data model
- the first service endpoint should expose that query contract over HTTP using JSON responses suitable for local and remote callers
- discovery must preserve per-unit firmware identity across runs, including the observed firmware app id, firmware version, build identifier, and self-reported board id when firmware exposes it
- when a stable unit identity is not yet known, discovery must try to match the observation against previously seen board families before treating it as a genuinely new card type
- if neither a known unit nor a known family matches, the system must start a draft profile for the new card family so later work can refine it
- family profiles should be enriched from the Stage 1 board catalog with exact board metadata where known and likely board candidates where the family is still being resolved
- the Stage 2 model must support operator-assigned labels, notes, and ownership-style metadata per physical unit, keyed by the stable unit identity
- the Stage 2 history layer must preserve cumulative owner, location, and purpose changes per physical unit rather than only the latest annotation snapshot
- each physical unit must be able to reference a per-unit AES key and an asymmetric key pair, with secret material stored under `keys/` and linked back to the stable unit identity
- discovery must persist a compact run-by-run observation ledger so later tools can compare the latest two scans without replaying the full cumulative history model
- the first diff view must report added or removed units, family population changes, and per-unit port or firmware changes between the latest two discovery runs`n- Stage 2 must be able to export stable JSON report files for the current bench state and the cumulative unit history so operators and remote systems can archive or hand off snapshots without querying the service live

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
- the service layer must also support remote calls from another system, not only the local browser UI
- the initial web UI may consume the Stage 2 query service directly until richer job-control APIs are added
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

