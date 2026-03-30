# Task Tracker

Last updated: 2026-03-31 01:05 Europe/London

- [x] Create required `notes/codex` source-of-truth documents
- [x] Create initial repository structure for project, install, update, and keys
- [x] Add sample board definitions for ESP32 and STM32
- [x] Add generator for firmware headers and API stubs
- [x] Add initial shared firmware API header
- [x] Add install/update scripts for Milestone 1
- [x] Initialize git repository and tag first milestone bootstrap
- [x] Add first concrete board profile for M5Stack Dial V1.1
- [x] Introduce reusable parts catalog for MCU, package, module, and attached devices
- [x] Refactor board schema to reference reusable parts with local board bindings
- [x] Add project-level override examples for firmware targets
- [x] Remove parent-directory include paths from generated code
- [x] Generate ordered board boot/setup stubs with platform SDK mapping
- [x] Add local toolchain/app/bootstrap layout under `project/`
- [x] Add top-level environment-managed `install-tools`, `build`, `clean`, and `program` scripts
- [x] Install local ESP-IDF under `project/` and complete an ESP32 build test
- [x] Add schema validation for board, part, and project definitions
- [x] Expand generic sample boards into reusable-part-based assemblies
- [x] Add concrete `esp-idf` and `stm32cube` implementations behind the generated boot stubs
- [x] Add automated STM32Cube local installation and a STM32 build test
- [x] Validate programming flow against multiple connected units
- [x] Validate programming flow against a connected ESP32 unit on COM3
- [x] Add reusable part-level init, smoke-test, and API contracts for shared devices such as `bm8563`, `ft3267`, `ws1850s`, and `gc9a01`
- [x] Add per-part help/man pages with datasheet, website, and API usage references for the future web interface
- [x] Add concrete board, project, generated-code, platform-stub, and help coverage for the attached CoreS3 + GNSS and P-NUCLEO-USB001 boards
- [x] Add a real ESP-IDF demo app and board-selectable build/program path for `m5stack_cores3_gnss_v1`
- [x] Build and flash the CoreS3 + GNSS demo on COM4 and capture serial bring-up output
- [x] Add local STM32CubeF0 support and a real STM32 demo app for `p_nucleo_usb001_f072rb_v1`
- [x] Complete a host-side F072 build validation for `p_nucleo_usb001_demo`
- [x] Milestone 1 complete
- [x] Add a persisted device-inventory schema and local inventory store for discovery
- [x] Add a Windows discovery script and top-level wrapper for the current bench
- [x] Capture and persist the first matched discovery snapshot for COM3-COM6
- [x] Persist stable per-unit identity fields so identical boards such as the two Dial units remain distinguishable across discovery runs
- [x] Add a cumulative unit-history layer for discovery runs
- [x] Match new physical units against previously seen board families before treating them as brand-new cards
- [x] Start draft family profiles for newly observed card families
- [x] Enrich family profiles with Stage 1 board metadata and likely board candidates

## Stage 2 Next Tasks

- [x] Add operator-assigned labels and notes per physical unit
- [x] Track firmware version/build identity per unit across discovery runs
- [x] Track board ownership, location, and purpose metadata in the history layer
- [x] Record unplugged or missing units without losing their history record
- [x] Add first-seen, last-seen, and last-missing transitions to the persisted family and unit model
- [x] Add a simple query CLI for listing units, families, and recent discovery changes
- [x] Add a diff view between the latest two discovery runs
- [x] Add exportable JSON reports for the current bench inventory and unit history
- [x] Normalize the history store into a simple SQLite database behind the same discovery model
- [x] Add schema validation for the new history and profile data files
- [x] Add per-unit key manifests linking each stable unit id to an AES key record and an asymmetric keypair record
- [x] Add key-generation and rotation tooling under keys/ for per-unit AES keys and asymmetric keypairs
- [x] Add a board-agent handshake path so firmware can self-identify board id, firmware version, and capabilities directly
- [x] Add stronger STM32-family fingerprinting beyond ST-LINK transport naming
- [x] Add USB hub or topology metadata when it can be observed reliably
- [x] Add serial-number and descriptor probing for devices that expose richer USB identity
- [x] Add identity-upgrade reconciliation when a transport-only unit later gains a chip MAC or richer fingerprint
- [x] Add conflict handling when observed identity evidence disagrees with prior history
- [x] Add manual override support when an operator wants to pin a unit to a board or family
- [x] Add merge/reconcile tooling for draft family profiles after a board type is understood
- [x] Add retention rules for historical observations so the local database stays manageable
- [x] Add a first local or remote service endpoint that exposes the shared query contract for web and external systems
- [x] Add basic service-layer APIs for querying inventory, history, and profiles
- [x] Add tests for discovery matching, history updates, and profile enrichment logic










## Stage 3 Next Tasks

- [x] Define the Stage 3 job model for validate, build, program, run, and debug actions
- [x] Add a persisted job store and JSON schemas for Stage 3 job requests, logs, artifacts, and results
- [x] Add board-selection and unit-selection resolution so Stage 3 jobs start from a stable unit id and matched board profile
- [x] Add a validation contract for controller, bus or IP block, and attached-device checks in dependency order
- [x] Add I2C scan support to validation and report configured addresses, missing configured addresses, and unexpected observed addresses
- [x] Add a structured board-validation report format with pass or fail status, discovered identity data, health data, and per-check evidence
- [x] Add reusable part-level validation hooks for shared devices so board checks reuse part knowledge instead of duplicating probe logic
- [x] Add board-level validation orchestration that gathers controller facts, bus scans, device checks, voltages, temperatures, firmware identity, MACs, and serial numbers where available
- [x] Add multi-project deployment metadata per board, including per-unit signed OTA policy and secure-project encrypted OTA policy
- [x] Define the reserved user-code area and stable user-facing board API boundary for firmware targets
- [x] Add build-job orchestration with captured logs, produced artifacts, and board or target metadata
- [x] Add program-job orchestration that uses the selected stable unit id and records flash logs and results
- [x] Add run-job orchestration that captures firmware console output and returns or streams it to the caller
- [x] Add debug-job orchestration that emits GDB launch details and IDE debugger metadata for supported MCU families
- [x] Expose Stage 3 job status, logs, reports, and artifacts through service APIs for later web UI use
- [x] Add repeatable local tests for Stage 3 validation logic and job-state transitions

## Stage 4 Next Tasks

- [x] Define the Stage 4 domain model for modules, composed modules, boards, and projects as a tree-based UI model on top of the current JSON definitions
- [x] Add Python-based read-only service APIs for module, board, and project trees plus linked help-page metadata
- [x] Add a first web app shell with navigation for inventory, modules, boards, projects, jobs, and reports
- [x] Add an inventory dashboard view that shows current units, history highlights, conflicts, overrides, and recent job activity
- [x] Add a module catalog view that lists known modules, composed modules, and attached help/man-page references
- [x] Add module help pages in the web UI with manufacturer links, API references, and test-script references
- [x] Add a module create flow for user-defined leaf modules
- [x] Add a composed-module editor so one module can be defined from child modules and local configuration
- [x] Add service write APIs for creating and updating module definitions safely
- [x] Add validation for user-created module definitions before they are persisted
- [x] Add a board catalog view that shows board assemblies, module trees, buses, signals, IO, boot order, and generated API references
- [x] Add a board create flow that starts from a newly discovered unit and produces a first-guess board definition from observed identity and known-family evidence
- [ ] Add a manual board create flow that starts from a blank or template definition without discovery first
- [ ] Add a board editor that lets the user add, remove, and reconfigure modules, buses, signals, and local board settings
- [ ] Add service write APIs for creating and updating board definitions safely
- [ ] Add board-config validation actions in the UI that run the Stage 3 validation flow and show mismatches between configured and observed hardware
- [ ] Add a project catalog view that shows board-targeted projects, app roots, user-code roots, SDK targets, OTA policy, and security policy
- [ ] Add a project create/edit flow for user-defined projects, including SDK code, third-party component code, module code, and selected board target
- [ ] Add service write APIs for creating and updating project definitions safely
- [ ] Add build/run/program/debug pages that launch and monitor Stage 3 jobs for the selected project, board, and unit
- [ ] Add job-log, report, and artifact views to the web UI on top of the existing Stage 3 APIs
- [ ] Add a known-module seeding flow so operator-provided module lists such as the supplied M5Stack module inventory can be imported into the catalog
- [ ] Seed the initial known-module catalog with the current M5Stack examples and the current Waveshare board examples, including aliases, chip families, and whether each entry is a standalone board, reusable module, or both
- [ ] Add tests for Stage 4 read APIs, write APIs, tree transforms, and first-guess board creation logic














