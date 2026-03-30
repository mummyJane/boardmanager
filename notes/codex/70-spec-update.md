## 2026-03-30 00:20 Europe/London

- Clarified the Stage 3 run-workflow requirement so it explicitly calls for a persisted bounded run log and a machine-readable run report, not only transient console streaming. This matches the job-store direction already used for build and program actions and keeps later web UI work consistent.

# Spec Updates

## 2026-03-28 14:30 Europe/London

- Added an explicit staged-delivery structure to the spec so board definitions, discovery, build/debug orchestration, and web UI can evolve in controlled milestones. This change is needed because the original project intent covered multiple major subsystems with different delivery horizons.

## 2026-03-28 14:52 Europe/London

- Expanded the stage-1 board-definition spec to explicitly cover grouped bus and connector metadata. This change is needed because the M5Stack Dial board includes internal I2C and SPI devices plus exposed expansion ports that should be modeled directly instead of being reduced to loose notes.

## 2026-03-28 15:03 Europe/London

- Expanded the stage-1 data model to separate reusable part definitions from board assemblies. This change is needed because multiple boards will reuse the same MCU families, packages, modules, and peripheral parts, while each board and project still needs local configuration and bindings.

## 2026-03-28 15:11 Europe/London

- Added a generated-code include-path rule forbidding parent-directory paths such as `..` in code files. This change is needed to match a build-system-managed include strategy and keep source layout independent from compiler include resolution.

## 2026-03-28 15:22 Europe/London

- Added explicit boot/setup sequencing and SDK binding to the stage-1 model. This change is needed because higher-level code can only assume a board is usable after controller, buses, devices, and board-level signals are initialized in a defined order, and that order depends on the chip SDK family (`esp-idf` or `stm32cube`).

## 2026-03-28 15:49 Europe/London

- Added a local-tooling requirement that SDKs, toolchains, downloads, and build outputs live under `project/`, with top-level scripts owning env setup and teardown. This change is needed so the workspace remains self-contained on Windows now and can be moved to a Raspberry Pi later with minimal assumptions about global host setup.

## 2026-03-28 16:10 Europe/London

- Added explicit validation requirements for part, board, and project definitions. This change is needed because the data model now has enough cross-references that generation, build, and flash should fail early on invalid wiring or override references instead of producing broken artifacts.

## 2026-03-28 16:16 Europe/London

- Completed the transition of sample boards to the reusable-part assembly schema. This change is needed to eliminate the mixed legacy/new board-definition paths and keep validation, generation, and future tooling focused on one consistent model.

## 2026-03-28 16:31 Europe/London

- Added an explicit generated-to-platform hook boundary for board boot and IO control. This change is needed because the project now has concrete `esp-idf` and `stm32cube` implementations, and those must survive regeneration while still matching the generated board API surface.

## 2026-03-28 19:45 Europe/London

- Added a host-side validation requirement for board builds without connected hardware. This change is needed because STM32 build verification should be possible from a Windows workstation even when no target board is physically attached.
- Clarified that the STM32 local build path may combine a local STM32Cube firmware package with a local Arm bare-metal compiler toolchain. This change is needed because the Windows STM32CubeCLT distribution is not ideal for unattended repo-owned installation, but the project still needs a reproducible local STM32 build path under project/.

## 2026-03-28 20:10 Europe/London

- Added a non-fatal smoke-test requirement for board demos and diagnostics. This change is needed because bring-up on real hardware should report which peripherals respond and which do not, instead of aborting the whole boot path on the first missing device.

## 2026-03-28 20:18 Europe/London

- Clarified that reusable parts, not boards, own init/setup contracts, smoke-test meaning, and reusable high-level API shape. This change is needed because shared devices such as `bm8563` should behave consistently across boards, with boards only supplying binding and local configuration.
- Added a requirement for per-part help/man pages suitable for the future web interface. This change is needed so each unit/part can expose its datasheet, website, and API usage documentation from a stable local source.

## 2026-03-29 09:19 Europe/London

- Clarified that Stage 2 USB discovery should preserve port target, chip MAC, USB instance identity, and any observed current-firmware signature for each connected unit. This change is needed because multiple ESP32-family units can share the same vendor and product IDs, so reliable selection and history need stronger identity evidence than VID/PID alone.

## 2026-03-29 09:55 Europe/London

- Added a requirement that reusable parts carry init/setup contracts, smoke-test meaning, high-level API guidance, and local help/man references. This change is needed because the later web interface and the generated firmware layer should both consume the same part-level operational metadata.
- Clarified that attached accessory stacks may be modeled as concrete board assemblies until the schema grows first-class nested subassembly support. This change is needed because the current CoreS3 + GNSS bench hardware must be represented now without inventing a second incompatible schema path.
- Added local help/man page coverage for concrete boards, not just reusable parts. This change is needed because operators need bench-level context such as boot order, connector usage, and known attached-unit notes in addition to part datasheets.

## 2026-03-29 11:40 Europe/London

- Expanded the Stage 1 completion criteria to require real demo/build coverage for the currently attached concrete boards, not just schema and generated-code coverage. This change is needed because Milestone 1 should end with both metadata and basic runnable firmware entry points for the real bench hardware.
- Clarified that the local STM32 tooling layout may include more than one STM32Cube family package under `project/toolchains/stm32cube`. This change is needed because the repo now needs both F4 and F0 support to cover the sample board and the attached Nucleo-F072RB.

## 2026-03-29 14:07 Europe/London

- Clarified that Stage 2 should begin with a stable persisted discovery record format before a full service or database implementation. This change is needed because the project now has enough real bench hardware to validate the observation model directly.
- Clarified that a simple local inventory store is acceptable for the first Stage 2 slice. This change is needed so the host-side discovery flow can be exercised immediately without blocking on full database selection and migration work.

## 2026-03-29 14:19 Europe/London

- Added a stable per-unit identity requirement to Stage 2 discovery, including MAC, USB instance path, serial number, and alias history. This change is needed because multiple attached boards can share the same model and USB VID/PID, so the system must track individual physical units across COM-port changes.


## 2026-03-29 14:45 Europe/London

- Expanded Stage 2 to require cumulative unit history, family-level fallback matching, and draft-profile creation for genuinely new card families. This change is needed because the system must distinguish between the same physical board, another board of a known type, and an entirely new card appearing on the bench.


## 2026-03-29 15:05 Europe/London

- Extended Stage 2 family profiles to include exact board metadata and likely board candidates from the Stage 1 catalog. This change is needed because a raw hardware fingerprint alone is not enough to help the operator decide which known board definition best fits a newly observed card family.


## 2026-03-29 15:27 Europe/London

- Added a Stage 2 requirement for operator-assigned labels and notes keyed by stable unit identity. This change is needed because identical boards on the bench must be distinguishable in operator language even when COM ports change over time.

## 2026-03-29 15:52 Europe/London

- Added a Stage 2 requirement for persisted per-unit firmware identity, not just a generic firmware signature. This change is needed because the bench now has multiple identical boards and the system must record which firmware app, version, build, and self-reported board id is actually running on each physical unit.
## 2026-03-29 16:12 Europe/London

- Added a Stage 2 requirement for cumulative owner, location, and purpose history per physical unit. This change is needed because bench-role metadata changes over time and should not overwrite the historical record.
- Added a per-unit security binding requirement covering one AES key and one asymmetric keypair per physical unit, stored under `keys/` and linked to the stable unit id. This change is needed because identical boards must be distinguishable both operationally and cryptographically.

## 2026-03-29 16:26 Europe/London

- Added a Stage 2 requirement that unplugged or currently missing units remain in history with explicit missing-state tracking. This change is needed because the bench inventory should retain continuity for physical units even when they are temporarily disconnected.

## 2026-03-29 16:43 Europe/London

- Added a Stage 2 requirement for explicit transition summaries in the persisted unit and family model. This change is needed because later query and web layers should be able to read first-seen, last-seen, last-present, and last-missing state directly instead of reconstructing transitions from multiple timestamps.

## 2026-03-29 17:01 Europe/London

- Clarified that the Stage 2 query layer should be reusable by both the future Milestone 4 web interface and remote callers from another system. This change is needed so the project does not grow one query path for local CLI use and a second incompatible path for the UI or external integrations.

## 2026-03-29 17:13 Europe/London

- Clarified that the first shared query contract should also be exposed through an HTTP service endpoint. This change is needed because the Milestone 4 web UI and remote callers from another system should not depend on local shell execution.

- 2026-03-29 17:55 Europe/London: Stage 2 spec clarified to require a compact discovery-run ledger and a latest-two-run diff view. Reason: the shared query/service layer now needs a stable way for operators, the future web UI, and remote systems to answer 'what changed since the last scan?' without reconstructing it from cumulative history only.

- 2026-03-29 18:00 Europe/London: Stage 2 spec updated to require exportable JSON report files for current bench state and cumulative unit history. Reason: operators and remote systems need a stable handoff artifact even when they are not calling the live service endpoint directly.

- 2026-03-29 18:20 Europe/London: Stage 2 spec updated to require synchronized SQLite persistence behind the existing discovery model. Reason: later service and UI work need normalized table access, but the current JSON contract should remain stable for operators and existing scripts.

- 2026-03-29 18:32 Europe/London: Stage 2 spec updated to require schema validation for persisted device-manager data and family profiles as part of normal validation. Reason: later service and UI layers depend on these files being structurally valid, not just present.

- 2026-03-29 18:48 Europe/London: Stage 2 spec updated to require a local root signing keypair and Board Manager-generated per-unit keys until boards generate their own during setup. Reason: the immediate security model needs signed per-unit manifests now, while later setup flows can migrate identity-key generation onto the boards themselves.

- 2026-03-29 19:05 Europe/London: Stage 2 spec updated to require a stable firmware board-agent handshake carrying board id, firmware version/build identity, and capability data. Reason: the discovery stack now has real multiple-unit validation on identical boards, and direct self-reporting is more reliable than heuristic banner matching alone for later web and remote consumers.

- 2026-03-29 19:30 Europe/London: Stage 2 spec updated to require registry-backed STM32-family identification fields such as USB VID/PID, manufacturer, service, and stable USB-instance evidence instead of transport-name-only matching. Reason: the attached Nucleo board is now better identified by its USB identity than by its friendly name alone.
- 2026-03-29 19:30 Europe/London: Stage 2 spec updated to allow non-destructive probing of known USB-to-UART bridges for MCU identity and boot banners. Reason: the newly attached COM7 board would otherwise remain a generic CP210x bridge, but safe probing exposed that it is an ESP32/WROOM-32-class board with a stable MAC and useful boot metadata.

- 2026-03-29 19:45 Europe/London: Stage 2 spec updated to require host-observed USB topology summaries when Windows exposes stable location information. Reason: the project now has multiple live units on the same bench, and later UI or operator workflows benefit from knowing where a unit is connected without relying only on COM-port names.

- 2026-03-29 20:05 Europe/London: Stage 2 spec updated to require promotion of richer USB descriptor fields such as product name, revision, driver path, and related hardware identifiers when the host exposes them. Reason: multiple attached units now share transport classes, and later matching or UI flows benefit from stable descriptor evidence beyond bare VID/PID and COM-port names.

- 2026-03-29 19:50 Europe/London: Add an explicit Stage 2 requirement that identity upgrades reconcile into one unit record with alias history. This was already implied by stable identity tracking, but the COM7 CP210x-to-ESP32 case showed the project needs the rule written down to avoid duplicate stale records.

- 2026-03-29 20:08 Europe/London: Add an explicit Stage 2 requirement for persisted identity-conflict records. Identity reconciliation alone was not enough once multiple evidence sources could disagree; the later UI and remote service need the disagreement preserved instead of hidden.

- 2026-03-29 20:22 Europe/London: Add an explicit Stage 2 requirement for clearable manual unit overrides. Bench operators need a way to pin uncertain boards for work, but the override must remain separate from the learned fingerprint history.

- 2026-03-29 20:45 Europe/London: Stage 2 spec updated to require operator-driven draft-family reconciliation with preserved merge provenance. Reason: the project now has enough unknown-family profiling to identify likely board families, but it still needs a controlled way to resolve them to known board definitions without rewriting or deleting the original discovery evidence.
- 2026-03-29 21:05 Europe/London: Stage 2 spec updated to require bounded retention for the run ledger and rolling observation arrays. Reason: discovery now has enough repeated scans that unmanaged JSON and SQLite growth would become a bench-maintenance problem on long-lived systems.
- 2026-03-29 21:20 Europe/London: Stage 2 spec updated to require direct read-only JSON service APIs for inventory, history, and profiles in addition to the query-view endpoint. Reason: later web and remote consumers need stable resource-style APIs for detailed object data, not only summary list views.
- 2026-03-29 21:40 Europe/London: Stage 2 spec updated to require repeatable local tests for discovery matching, history updates, and profile or service-data logic. Reason: the Stage 2 stack is now wide enough that future UI and job-control work need a stable regression net before more layers are added.
- 2026-03-29 22:05 Europe/London: Expanded the Stage 3 spec from a thin build/program/debug placeholder into a validate/build/program/run/debug milestone. Reason: the user clarified that Milestone 3 must verify configured board hardware against observed buses and devices, gather identity and health facts, preserve build logs, return runtime output, and expose debugger launch metadata for both CLI and IDE-driven use.
- 2026-03-29 22:25 Europe/London: Added an explicit Stage 3 requirement for a persisted local job store covering validate, build, program, run, and debug actions. Reason: later logs, reports, artifacts, and web or remote status views need a stable execution record instead of ad hoc script output.
- 2026-03-29 22:40 Europe/London: Added an explicit Stage 3 requirement that job creation resolve against the current Stage 2 inventory and store the selected stable unit id plus matched board profile. Reason: validate/program/run/debug operations must be tied to the actual present unit, not only the operator's raw request text.
- 2026-03-29 22:55 Europe/London: Added a Stage 3 requirement that the validation contract be generated into a machine-readable board-specific plan. Reason: later runtime validation, pass/fail reports, and service responses need a stable ordered contract derived from board and part metadata, not only informal script behavior.
- 2026-03-29 23:05 Europe/London: Added a Stage 3 note that validation runners may consume structured serial or board-agent scan evidence such as `BoardManagerI2CScan:` lines. Reason: early validation needs a low-friction way to move bus-scan results from firmware to the host before a richer command protocol exists.
- 2026-03-29 23:20 Europe/London: Expanded the Stage 3 report requirement to call out identity fields, per-check evidence, and health placeholders explicitly. Reason: later service APIs and the web UI need a stable report shape before all runtime probes exist on every board.
- 2026-03-29 22:19 Europe/London: Stage 3 spec updated to require machine-readable reusable part validation hooks as the preferred source for shared device validation steps. Reason: the generated validation contracts now need a structured way to reuse device-probe logic across boards without copying free-text smoke-test lines into every board-specific contract.
- 2026-03-29 22:36 Europe/London: Stage 3 spec updated to require report-time merging of Stage 2 identity with live validation capture. Reason: real bench validation often attaches to a board after boot, so the report still needs stable firmware and identity facts even when the current capture window only sees steady-state logs.

- 2026-03-30 00:25 Europe/London: Stage 3 spec updated to require project-level app roots, user-code roots, stable API boundaries, multi-project-per-board resolution, and explicit OTA signing/encryption policy. Reason: the same physical board can now host multiple deployable app profiles, and later update jobs need to know whether the payload must be per-unit signed only or both signed and encrypted.

- 2026-03-30 00:45 Europe/London: Stage 3 spec updated to require a stable handoff from framework entrypoints into project-local user modules under the reserved user-code root. Reason: generated board support and future orchestration need a predictable non-user-owned entry layer, while application logic still needs a protected area that Board Manager does not overwrite.
- 2026-03-30 17:06 Europe/London: Stage 3 spec updated to require bounded configure/build timeouts for build jobs. Reason: real toolchain runs on this Windows host can hang during STM32 CMake configure, and the service/UI layer needs a normal failed job record instead of an indefinitely running build.
- 2026-03-30 17:22 Europe/London: Stage 3 spec updated to require program workflows to resolve stable unit ids to current transport endpoints, capture flash logs, and enforce bounded flash timeouts. Reason: flashing is now executed through the same job model as build, and multi-unit benches need stable-unit targeting rather than raw COM-port-only requests.

## 2026-03-30 17:00 Europe/London

- Clarified the Stage 3 debug requirement so the chosen server launch command is part of the persisted debugger metadata. Without that, a symbol path and GDB executable alone are not enough to reproduce a session from the web UI or another client.
## 2026-03-30 17:25 Europe/London

- Clarified the Stage 3 service requirement so the service layer explicitly exposes job lists, log tails, parsed reports, and artifact metadata. That is the practical minimum the later web UI needs to show Stage 3 activity without direct filesystem access.
## 2026-03-30 18:10 Europe/London

- No feature-scope change to Stage 3, but the completion criteria are now satisfied by the local regression suite plus the existing live bench validations. That gives a repeatable gate without making hardware attachment mandatory for every run.

- 2026-03-30 18:45 Europe/London: Expanded Stage 4 from a generic web-UI placeholder into a tree-based web interface milestone with module config, board config, and build/run as the three main operator areas. Reason: the user clarified that the UI must model composed modules, discovery-assisted or manual board creation, project build/run targeting, and a module help/catalog system rather than only showing inventory and job buttons.

- 2026-03-30 19:00 Europe/London: Stage 4 spec updated to call out the first concrete seed set for the known-module and known-board catalog, based on the user-provided M5Stack and Waveshare examples. Reason: the seeding/import work now has a real starting inventory and must preserve the difference between standalone boards and reusable modules.

- 2026-03-30 19:25 Europe/London: Stage 4 spec updated to require a Python-based web server/service host and to define Task 1 as a generated tree model for modules, boards, and projects under project/web-ui. Reason: the user explicitly requested Python for the web server, and the UI now needs one stable tree artifact instead of ad hoc reconstruction from multiple raw definition folders.

- 2026-03-30 20:05 Europe/London: Stage 4 spec updated to require the first Python read-only API surface over the generated tree model, including module, board, project, and linked help-content endpoints. Reason: the web UI now has a Python-hosted read path that matches the user's runtime preference and can serve both tree data and local help pages from one service layer.

- 2026-03-30 20:30 Europe/London: Stage 4 spec updated to call out the first served web shell with top-level navigation for inventory, modules, boards, projects, jobs, and reports. Reason: the Python Stage 4 service now hosts a real browser shell, even though some sections still intentionally point at later Stage 4 tasks.

- 2026-03-30 20:50 Europe/London: Stage 4 spec updated to call out the inventory dashboard as an aggregated bench view over Stage 2 inventory/history plus recent Stage 3 validation and job state. Reason: the first real inventory dashboard now exists and the UI contract should reflect that it is more than a raw unit list.

- 2026-03-30 21:20 Europe/London: Stage 4 spec updated to call out the module catalog view as an aggregated web-facing catalog over the tree model, including vendor, help-reference, role, and composition-coverage summaries. Reason: the Python service and shell now expose a real module catalog contract instead of only a raw modules tree listing.

- 2026-03-30 21:45 Europe/London: Stage 4 spec updated to call out module help pages as a real shell detail view backed by a per-module API payload with references, declared API entries, default config, and local help markdown. Reason: the Modules view now exposes documentation detail in the web UI instead of only listing catalog rows.
