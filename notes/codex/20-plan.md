## Milestone 4 Current Focus

- turn the Stage 1-3 data and service layers into the first browser-facing operator workflow
- keep the UI tree-based around modules, boards, and projects instead of flattening everything into raw files
- reuse the existing Stage 2 and Stage 3 services wherever possible before adding new write APIs
- put new Stage 4 web-serving work on a Python-based service host rather than extending the current Node HTTP service as the long-term UI server

# Board Manager Milestone Plan

Last updated: 2026-03-30 23:15 Europe/London

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

## Milestone 2: USB Discovery And Inventory Model

Objective:
Add a local host-side discovery flow that fingerprints connected units, matches them back to Stage 1 board definitions, and persists an inventory snapshot for later service and database work.

Status:
In progress on 2026-03-29 with persisted discovery, history, query, service, reports, SQLite sync, key management, board-agent capture, registry-backed STM32 matching, and live profiling of an additional unknown ESP32-class unit on COM7.

Initial success criteria:

- discovery output has a stable persisted schema
- current connected units can be scanned from the local host
- observations capture port, USB identity, and firmware or chip signatures where possible
- identical board models remain distinguishable through stable unit identity keys based on MAC, USB instance, serial number, or alias history
- discovery records match back to known board definitions
- the latest snapshot is persisted under `project/device-manager`
- cumulative unit and family history is persisted across discovery runs
- a newly seen physical unit can fall back to a previously seen family match before being treated as a brand-new card type
- discovery starts a draft family profile when it encounters a genuinely new card family
- family profiles are enriched with exact board metadata or likely board candidates from the Stage 1 board catalog
- operators can assign stable labels and notes to physical units without depending on the current COM port
- discovery persists firmware app id, version, build id, and self-reported board id per unit where firmware exposes it
- firmware board-agent handshakes expose self-reported capability sets that flow into discovery, history, query, and SQLite persistence
- unit history preserves cumulative owner, location, and purpose changes for each stable unit id
- discovery preserves known units that are missing from the latest scan and records their missing state
- the unit and family model preserve transition summaries for first-seen, last-seen, last-present, and last-missing state changes
- the model reserves a per-unit security binding for an AES key and an asymmetric keypair stored under `keys/`
- the first query layer is reusable by operators now and by the future web UI and remote systems later
- the first HTTP service endpoint exposes that same query contract for local and remote consumers
- discovery persists a compact run ledger and can diff the latest two runs for added, removed, or changed units and families`n- operators can export the current bench snapshot and cumulative history as stable JSON report files under project/device-manager/reports
- discovery and annotation flows synchronize the persisted Stage 2 model into project/device-manager/data/device-manager.sqlite for normalized table access
- the standard validation flow also checks device-manager data files and family profiles against their schemas
- local key-management tooling now maintains a root signer plus per-unit AES and identity keys under keys/ for the currently attached units
- STM32-family matching uses registry-backed USB identity fields instead of only STLink transport naming
- known USB-to-UART bridges can be probed non-destructively for MCU identity so unknown ESP-class boards can be promoted to MAC-based units and richer draft profiles
- the current unknown COM7 board is promoted from a generic CP210x bridge record to an ESP32-based draft family with captured MAC, chip, flash size, and boot-banner evidence
- discovery now records parsed USB topology summaries from Windows location information, including path-style summaries for the native USB boards and hub/port summaries for bridged boards such as COM7
- discovery now persists richer USB descriptor identity fields including product name, revision, driver key, and hardware-id derived revision data for the current bench devices

## Future Milestones

### Milestone 3: Validate/Build/Run/Debug Orchestration

Objective:
Turn the Stage 1 board definitions and Stage 2 unit inventory into operator-facing workflows that can validate a selected board, build firmware, flash it to a selected unit, stream runtime output, and launch reproducible debug sessions.

Initial success criteria:

- a selected physical unit can be matched to a board profile and used as the input to Stage 3 jobs
- board validation walks controller, buses or IP blocks, and attached devices in dependency order
- generated machine-readable validation contracts exist per board and drive the ordered validation phases and checks
- the first validation runner now compares live or captured `BoardManagerI2CScan:` serial output against the contract and persists a JSON validation report
- validation compares observed hardware against configured board expectations and records missing or unexpected items
- validation reports identity and health facts such as MAC, serial, firmware id, firmware version, build id, voltages, and temperatures where available
- validation produces a machine-readable report plus a human-readable summary with pass and fail results
- the first structured validation report schema now captures identity, summary, health, ordered phases, per-check evidence, and raw capture lines
- generated validation contracts now reuse machine-readable part validation hooks where shared devices define them, instead of duplicating board-local device probe wording
- the validation runner now merges Stage 2 identity and firmware facts with live serial evidence into one structured report and records controller facts, signal samples, and health metrics where they are available
- build orchestration is tied to a board profile and firmware target and emits artifacts plus captured build logs
- run orchestration can capture and return console output from the selected unit
- programming is tied to the selected physical unit so identical boards can be targeted safely
- debug orchestration emits reproducible GDB and IDE session metadata
- job records are exposed in a service-friendly form for later Milestone 4 UI work
- an initial local job store exists for queued or completed validate, build, program, run, and debug actions
- job creation resolves board-only, unit-only, board-plus-unit, and project-app requests against the current bench inventory instead of storing unresolved operator intent only
- project metadata now allows more than one deployable app profile per board, including per-unit signed OTA policy and secure-project encrypted OTA policy
- firmware targets now reserve a project-local user-code module behind a shared user-facing API boundary, so board bring-up entrypoints stay stable while user code remains isolated
- build jobs now run through the Stage 3 job store, capture tool stdout/stderr into per-job logs, emit JSON build reports, and fail cleanly on bounded step timeouts
- program jobs now run through the same Stage 3 job store, resolve stable unit ids to current transport ports, capture flash logs, and produce JSON program reports

### Milestone 4: Web Interface And Configuration Workflows

Objective:
Add the first real web interface and supporting service APIs around the existing discovery, board-definition, and job-execution stack. The UI should let operators browse known modules and boards, create or edit module/board/project definitions, and drive build/program/run/debug workflows against discovered hardware.

Status:
Planning started on 2026-03-30 from the current Milestone 1-3 foundation.

Initial success criteria:

- a browser UI shell exists and talks only to the local service layer
- the UI can show the current bench inventory, per-unit history, validation status, and recent Stage 3 job activity
- the UI can show a module catalog view with vendor, role, help-reference, and composition-coverage summaries
- modules are represented as a tree, including both leaf modules and composed modules made from child modules
- each module has a help/documentation view with manufacturer links, API references, local help content, and test-script references
- boards are represented as module assemblies with local wiring/config data and are editable through the UI
- board creation works both from a discovered unit with first-guess detection and from a manual blank/template flow
- the system can test a board config against attached hardware where possible and report config mismatches
- projects are represented as board-targeted build/run definitions that combine user code, SDK code, third-party components, and module code
- the build/run area can start or inspect validate, build, program, run, and debug jobs through the existing service layer
- a persistent known-module catalog exists and can be seeded from operator-provided module inventories such as M5Stack module lists
- write APIs exist for the web UI to create and update modules, boards, and projects safely

Planned slices:

- Slice 1: define the Stage 4 UI/domain model and generate a stable tree artifact for modules, boards, projects, and help pages
- Slice 2: add Python-based read APIs for tree views over modules, boards, projects, and help pages
- Slice 3: scaffold the web app shell with inventory, module, board, and project navigation
- Slice 4: add module catalog management, module help pages, and composed-module editing
  - leaf-module create flow complete
  - composed-module editor complete with child-module composition and local default config
  - safe module write APIs now include create, compose, edit-payload readout, and guarded update for user-owned modules
  - module-definition validation now exists as a reusable preflight service check before writes
- Slice 5: add board create/edit flows, including discovery-assisted first guess and manual create
  - board catalog read view complete with assembly detail, boot order, and generated-artifact references
  - discovery-assisted board-create flow complete with first-guess draft generation from Stage 2 unit identity
  - manual board-create flow complete with blank-board and template-backed creation paths
- Slice 6: add board-config validation views and hardware test/report integration
- Slice 7: add project/build/run pages that sit on top of the Stage 3 job APIs
- Slice 8: add service write APIs and persistence workflows for user-created modules, boards, and projects

- 2026-03-30 18:45 Europe/London: Milestone 4 planning now treats the UI as three connected areas: module config, board config, and build/run. The shared model is tree-based, with module composition feeding board assembly and board selection feeding project execution.
- 2026-03-30 19:25 Europe/London: Milestone 4 planning now also reserves the long-term web-serving role for a Python-based service host, while current Node scripts remain acceptable for generation and validation work.





- 2026-03-29 19:50 Europe/London: Completed identity-upgrade reconciliation so transport-only unit history collapses into stronger MAC-backed identity records instead of leaving split history.

- 2026-03-29 20:08 Europe/London: Completed conflict handling for disagreeing identity evidence, with persisted conflict ledger entries, query support, and SQLite sync for later UI and operator workflows.

- 2026-03-29 20:22 Europe/London: Completed manual override support for pinning units to board or family identities, with clearable persistent overrides merged into discovery and query output.

- 2026-03-29 20:45 Europe/London: Completed draft family reconciliation tooling with a dry-run-first operator flow that can promote a draft profile into a known board profile while preserving merge provenance on the source profile.


- 2026-03-29 21:05 Europe/London: Completed retention rules for Stage 2 by capping discovery-run history and rolling observed arrays, with the retention pass wired into discover.ps1 before SQLite sync.


- 2026-03-29 21:20 Europe/London: Completed basic service-layer APIs with direct JSON endpoints for inventory, history, and profiles on top of the existing query service.


- 2026-03-29 21:40 Europe/London: Completed Stage 2 test coverage with a local dependency-free Node assertion runner for discovery matching, history transitions, board-candidate enrichment, and service-data filtering.

















- extend Stage 3 from run capture into reproducible debug launch metadata for ESP32 and STM32


- extend the shared HTTP service from Stage 2 inventory data into Stage 3 job, log, report, and artifact APIs for the future web UI


- Milestone 3 is now closed out with local regression coverage for Stage 3 validation logic and job-state transitions


- 2026-03-30 20:05 Europe/London: Completed the first Python Stage 4 read-only API over the generated tree model, including module, board, project, and help-content endpoints for the later web UI.

- 2026-03-30 20:30 Europe/London: Completed the first served Stage 4 web shell with top-level navigation for inventory, modules, boards, projects, jobs, and reports, hosted from the Python Stage 4 service.

- 2026-03-30 20:50 Europe/London: Completed the first inventory dashboard view, backed by a Python endpoint that merges Stage 2 inventory/history with recent Stage 3 validation reports and job activity.
