# Board Manager Spec

Last updated: 2026-03-29 22:25 Europe/London

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
- a persisted discovery-run ledger and a diff view over the latest two runs
- exportable JSON reports for the current bench inventory and cumulative unit history
- a normalized SQLite database synchronized from the persisted Stage 2 discovery model

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
- firmware should expose a stable board-agent handshake line so discovery can capture self-reported board id, firmware version, build identifier, and capability set directly without relying only on heuristic banners
- when a stable unit identity is not yet known, discovery must try to match the observation against previously seen board families before treating it as a genuinely new card type
- if neither a known unit nor a known family matches, the system must start a draft profile for the new card family so later work can refine it
- family profiles should be enriched from the Stage 1 board catalog with exact board metadata where known and likely board candidates where the family is still being resolved
- the Stage 2 model must support operator-assigned labels, notes, and ownership-style metadata per physical unit, keyed by the stable unit identity
- the Stage 2 history layer must preserve cumulative owner, location, and purpose changes per physical unit rather than only the latest annotation snapshot
- each physical unit must be able to reference a per-unit AES key and an asymmetric key pair, with secret material stored under `keys/` and linked back to the stable unit identity
- a local root signing keypair must be maintained under `keys/` so Board Manager can sign per-unit key payloads
- until boards generate their own keypairs during setup, Board Manager should generate per-unit AES keys and asymmetric identity keypairs locally and record signed per-unit key manifests
- discovery must persist a compact run-by-run observation ledger so later tools can compare the latest two scans without replaying the full cumulative history model
- the first diff view must report added or removed units, family population changes, and per-unit port or firmware changes between the latest two discovery runs
- Stage 2 must be able to export stable JSON report files for the current bench state and the cumulative unit history so operators and remote systems can archive or hand off snapshots without querying the service live
- the persisted Stage 2 JSON model must be synchronized into a simple SQLite database so later service and UI work can query normalized tables without replacing the existing discovery contract
- the SQLite store should update automatically when discovery or unit-annotation flows change the persisted Stage 2 JSON state
- Stage 2 persisted data files and family profiles must be validated against their schemas as part of the standard validation flow
- STM32-family discovery must use registry-backed USB identity fields such as VID/PID, manufacturer, service, and stable USB-instance or base-serial evidence instead of relying only on STLink transport naming
- discovery should probe known USB-to-UART bridge families for non-destructive MCU identity where possible so unresolved ESP-class boards can be promoted from generic bridge records to chip-aware draft profiles
- discovery should preserve boot ROM, bootloader, and module-identification banners for unresolved units when those can be observed safely over the target serial link
- discovery should preserve host-observed USB topology summaries when Windows exposes stable port or path information, so later UI and operator tooling can distinguish where a unit is physically connected
- discovery should promote richer USB descriptor fields such as product name, revision, driver path, and related hardware identifiers when the host exposes them, so board matching and operator workflows can use more than VID/PID alone
- when a unit is first seen through a transport-only identity and later yields a stronger fingerprint such as a chip MAC, discovery must reconcile that evidence into one physical-unit record and preserve the older key as alias history instead of leaving duplicate unit records
- when multiple identity evidence sources for one observation disagree with prior history, discovery must preserve a conflict record with the competing unit identities and the chosen canonical match instead of silently overwriting history
- operators must be able to pin a physical unit to a board id or family key through a persistent manual override, and later clear that override without mutating the underlying observed fingerprints
- operators must be able to reconcile a draft family profile to a known board definition while preserving the original profile as merge provenance instead of silently deleting it
- Stage 2 must enforce retention caps for run-ledger history and long per-unit observation arrays so the persisted JSON and SQLite stores stay manageable on long-lived benches
- the service layer must expose direct JSON APIs for raw inventory, cumulative history, and family-profile data in addition to the shared query views
- Stage 2 must include repeatable local tests for discovery matching, history-state updates, and profile-enrichment or service-data logic so later milestones can extend the stack without breaking current bench behavior

### Stage 3: Build, Program, And Debug

Deliverables:

- board validation and bring-up reports driven from the board definition and discovered unit identity
- build orchestration per board family and firmware target
- flashing workflows for ESP32 and STM32
- run and log-capture workflows for board firmware
- debug session launch support for CLI and IDE-driven flows
- job status and artifact APIs for the future web interface

Requirements:

- build definitions must be tied to a board profile and firmware target
- programming tools must be pluggable by MCU family
- debug support must capture enough metadata to reproduce the session
- Stage 3 validation must start from a selected physical unit and its matched board profile from Stage 2
- board validation must verify the controller first, then controller-owned buses or IP blocks, then configured attached devices in dependency order
- validation must compare observed hardware against the Stage 1 board config and report both missing configured items and unexpected observed items
- for I2C-style buses, validation must perform a scan where possible, confirm configured addresses, and report extra observed addresses that are not declared in the board config
- validation should gather self-reported or probed unit facts where available, including chip type, MAC address, serial number, firmware id, firmware version, build id, voltages, temperatures, and similar health or identity data
- validation output must be emitted as a structured pass or fail report that can be stored, queried later, and shown directly to operators
- Stage 3 must define a reserved user-code area per board or firmware target so generated board support and operator tooling do not overwrite user application code
- generated or shared firmware APIs must define the stable boundary that user code calls for board-level functions and part-level services
- build workflows must emit a build log, build result, selected board id, selected unit id where relevant, and produced artifacts
- run workflows must be able to stream or return firmware console output back to the operator or service caller
- debug workflows must support command-line GDB launch details plus enough debugger metadata for IDE integration, including transport, symbol path, and target selection
- job execution for validate, build, program, run, and debug must produce machine-readable status records and human-readable logs for later web UI consumption`r`n- Stage 3 must persist a local job store for validate, build, program, run, and debug actions, including request parameters, resolved board or unit selection, logs, artifacts, and result summaries

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







