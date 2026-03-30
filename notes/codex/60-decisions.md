## 2026-03-30 00:00 Europe/London

- Run-job orchestration will use PowerShell System.IO.Ports.SerialPort for console capture instead of depending on the ESP-IDF Python environment. This keeps the run path simpler, works for both ESP32 and STM32 virtual COM ports, and avoids another long-running external tool chain in the hot path.

# Decisions

## 2026-03-28 14:30 Europe/London

- Use JSON for the first iteration of board definitions to keep review and scripting simple.
- Use generated C headers and C source stubs as the firmware integration layer for the first milestone.
- Keep the first milestone dependency-light by using a plain Node.js generator script with no third-party packages.
- Reserve `project/web` and `project/device-manager` for later milestones instead of prematurely scaffolding framework-specific stacks.
- Commit generated firmware artifacts so schema and API-surface changes stay reviewable in git.
- Extend the board-definition schema with `power`, `buses`, and `connectors` fields so complex boards such as M5Stack Dial can be represented without flattening everything into GPIO-only entries.
- Treat product pages and official pin maps as the preferred source for initial board profiles.
- Model reusable parts separately from boards so MCU dies, packages, modules, and peripheral devices can be shared across multiple board definitions.
- Make the board file an assembly-and-binding layer, not the sole source of every part's intrinsic metadata.
- Keep generated and hand-written code free of `..` include paths; build-system include directories must handle path resolution.
- Generate ordered board boot/setup stubs from board metadata instead of leaving board init as an undifferentiated TODO.
- Bind ESP32-family targets to `esp-idf` and STM32-family targets to `stm32cube` in the generated metadata and boot stubs.

## 2026-03-28 15:36 Europe/London

- Treat locally installed SDKs, downloaded tools, cached installers, and build outputs under `project/` as machine-local artifacts and exclude them from git.

## 2026-03-28 15:49 Europe/London

- Store project-managed SDKs, downloaded tools, app scaffolds, and build outputs under `project/` so the full tool/bootstrap environment can move with the workspace.
- Use top-level PowerShell wrapper scripts that set up and tear down process-local SDK environment variables automatically instead of relying on the caller to source an environment first.
- Use a CMake-based ESP-IDF application as the first real build target because it exercises the local-tool bootstrap on Windows immediately.

## 2026-03-28 15:53 Europe/London

- Treat generated ESP-IDF `sdkconfig` files and local workspace files as machine-local artifacts and exclude them from git.

## 2026-03-28 16:10 Europe/London

- Treat metadata validation as a required pre-build and pre-program gate so broken part references, boot steps, and project overrides fail before toolchain work starts.

## 2026-03-28 16:16 Europe/London

- Remove the remaining legacy flat-board samples and keep all active board definitions on the reusable controller/package/module schema so validation and generation only have one primary path to maintain.

## 2026-03-28 16:31 Europe/London

- Keep generated board files as stable wrappers and move SDK-specific boot and signal logic into hand-written platform hook files under `project/platform`, so regeneration does not clobber concrete firmware work.
- Validate the first concrete platform layer by wiring it into the real ESP-IDF app build, not just by generating files.

## 2026-03-28 19:45 Europe/London

- Use the STM32Cube firmware package plus a local Arm GNU bare-metal compiler for the Windows STM32 host-build path, because STM32CubeCLT unattended installation is not straightforward enough for a repo-owned bootstrap script.
- Fetch only the STM32Cube submodules required by the sample board build to keep the local install smaller and reduce unnecessary churn under antivirus scanning.

## 2026-03-28 20:10 Europe/London

- Keep board smoke tests non-fatal and report peripheral presence explicitly, so bring-up can distinguish between a dead board and a partially working board.
- Record physical-board smoke-test results in context instead of treating them as stable spec facts, because attached hardware state can vary from session to session.

## 2026-03-28 20:18 Europe/London

- Move init/setup smoke tests and high-level API ownership down to reusable parts such as `bm8563`, instead of treating them as primarily board-level behaviors.
- Add a local per-part help/man page convention now, so the later web interface has a stable source for datasheet links, vendor pages, and API usage guidance.

## 2026-03-29 09:19 Europe/London

- Use the target port plus hardware fingerprint data such as USB instance path, chip MAC, and observed boot log signature as the first Stage 2 identity record for connected ESP32-family units.
- Treat a successful targeted flash followed by unit-specific serial output on the same port as the minimum validation for multi-unit programming correctness.

## 2026-03-29 09:55 Europe/London

- Treat the currently attached CoreS3 plus GNSS hardware as a concrete board assembly in the repo today, instead of blocking on a richer nested accessory-module schema.
- Promote reusable part metadata to include init/setup contracts, smoke-test meaning, high-level API shape, and local help references so board-level code and the future web UI can share one source of truth.
- Add board-level help pages alongside part help pages for the real bench hardware, because operators will need board assembly context as well as per-part detail.

## 2026-03-29 11:40 Europe/London

- Finish Milestone 1 by adding real demo apps for the currently attached CoreS3 and F072 boards instead of leaving them as metadata-only definitions.
- Extend the local STM32 bootstrap to cover both STM32CubeF4 and STM32CubeF0 so the repo can host-build both the sample F4 board and the attached F072 board under one top-level tool flow.
- Prefer small incremental edits and targeted retries on this Windows machine when antivirus or sandboxing interferes, rather than broad rewrite or download steps.

## 2026-03-29 14:07 Europe/London

- Start Milestone 2 with a persisted local discovery snapshot and matching heuristics before introducing a background service or database engine.
- Use a simple JSON inventory file for the first discovery slice so the observation format can stabilize before committing to SQLite or another storage layer.
- Reuse the local ESP-IDF Python environment for ESP32 fingerprinting so discovery can read MACs and short serial signatures without adding new host dependencies.

## 2026-03-29 14:19 Europe/London

- Use a stable unit-key priority of chip MAC, then USB instance path, then serial number, then current port fallback so identical bench units remain distinguishable across reconnects.
- Preserve alias history such as prior COM ports and Windows device names in the discovery record so operator-facing tooling can recognize a unit even when its active port changes.


## 2026-03-29 14:45 Europe/London

- Separate the Stage 2 persistence into three layers: latest inventory snapshot, cumulative unit history, and family profile stubs. This keeps the operator view simple while preserving enough historical data to recognize both known units and known card types.
- Prefer a board-family key such as `board:<boardId>` when a heuristic match exists, and only fall back to generic hardware fingerprints for unknown families. This keeps profile growth aligned with the Stage 1 board model instead of fragmenting known boards into too many profiles.
- Treat the first history-building pass as valid even when it labels the first members of a family as `new-family`; the next pass is the expected proof that stable known-unit recognition works.


## 2026-03-29 15:05 Europe/London

- Keep board-catalog enrichment in a small helper module instead of embedding more board-definition logic directly into the discovery script. This keeps the discovery flow readable while still letting profiles reuse Stage 1 metadata.
- Enrich family profiles with both an exact board summary and scored candidate boards. Exact metadata helps when the family is already known, while candidate ranking gives the operator a practical starting point for genuinely new or unresolved card families.


## 2026-03-29 15:27 Europe/London

- Store operator-facing labels and notes in a separate annotation file keyed by stable unit id instead of mixing manual edits directly into discovery history. This keeps discovery reproducible while still letting operators attach local meaning to physical units.
- Make the annotation CLI target the stable unit key, not the current COM port, so labels survive replug and port renumbering.

## 2026-03-29 15:52 Europe/London

- Prefer a machine-readable firmware boot line over heuristic banner matching when the firmware exposes one.
- Standardize the firmware identity line as `BoardManagerFirmware: app=<app> version=<version> build=<build-id> board=<board-id>`.
- Persist firmware app id, version, build id, and self-reported board id in both the latest inventory snapshot and cumulative unit history so physical identity and firmware state can be tracked independently.
## 2026-03-29 16:12 Europe/London

- Treat owner, location, and purpose as historical unit metadata, not just mutable current annotations. The latest annotation remains useful for operator workflows, but the history layer must preserve previous bench assignments.
- Reserve the `keys/` folder for per-unit secret material and link future key records to the stable unit identity rather than board model alone, because identical boards must still have different keys.

## 2026-03-29 16:26 Europe/London

- Keep missing units in cumulative history instead of deleting them when they are not present on the latest scan. Operator workflows need durable per-unit records even when hardware is temporarily unplugged.
- Model missing state as a unit-level concern first with `present`, `lastPresentAt`, `lastMissingAt`, and `missingCount`; family-level transition summaries can be added separately.

## 2026-03-29 16:43 Europe/London

- Add explicit transition summaries to both unit and family history rather than making callers infer state changes only from raw timestamps. This keeps the later service and web layers simpler and less error-prone.
- Track family presence from the current set of units in that family, not from transport heuristics alone. Family state should derive from unit state so the summary stays consistent.

## 2026-03-29 17:01 Europe/London

- Start the query layer as a shared script that returns stable JSON, with the CLI as a wrapper. That keeps the first operator tooling lightweight while avoiding a second incompatible path for the future web UI and remote systems.
- Treat human-readable text output as a convenience view only; JSON is the machine-facing contract.

## 2026-03-29 17:13 Europe/London

- Keep the query logic in a reusable library module and put both the CLI and HTTP service on top of it. That avoids divergence between operator tooling, the future web UI, and remote integrations.
- Use a simple JSON-over-HTTP service first instead of prematurely introducing a larger framework. The service contract matters more than the transport stack at this stage.

- 2026-03-29 17:55 Europe/London: Added a compact discovery-runs ledger separate from unit-history so latest-two-run diffs can be computed cheaply without replaying the full cumulative history model.
- 2026-03-29 17:55 Europe/London: Kept the diff model focused on operator-relevant changes first: unit add/remove, port change, firmware change, family add/remove, and family population change.

- 2026-03-29 18:00 Europe/London: Report export reuses the persisted Stage 2 data and shared query layer rather than maintaining a separate reporting-only model, so exported JSON stays aligned with CLI and service views.

- 2026-03-29 18:20 Europe/London: Kept JSON as the readable persisted discovery contract and synchronized it into SQLite, rather than making SQLite the only write target, so the existing CLI, service, and report paths remain stable while normalized tables become available for later service work.
- 2026-03-29 18:20 Europe/London: SQLite sync is triggered automatically by discovery and annotation flows so the DB does not drift behind the Stage 2 JSON state.

- 2026-03-29 18:32 Europe/London: Implemented a small in-repo JSON Schema subset validator for device-manager data instead of adding a third-party dependency, because the current schemas only need type, required, properties, items, minimum, and additionalProperties=false checks.

- 2026-03-29 18:48 Europe/London: Used a local root RSA-3072 signing keypair and per-unit Ed25519 identity keypairs with AES-256 symmetric keys. The root signs a per-unit payload that binds the stable unit id, AES key record, and unit public key record together.
- 2026-03-29 18:48 Europe/London: Kept all generated key material and local manifests under keys/ and out of git; only tooling, docs, and schemas are tracked in the repo.

## 2026-03-29 19:05 Europe/London

- Extend the generated board descriptor once to carry sorted capability lists, rather than duplicating per-board capability strings inside each firmware app. This keeps the board-agent handshake tied to the same Stage 1 source-of-truth metadata as the rest of the generated firmware surface.
- Keep the new board-agent handshake additive: firmware still emits the older `BoardManagerFirmware:` line, while the new `BoardManagerAgent:` line becomes the preferred source for self-reported board id and capability data.
- Fold board-agent identity back into the existing `firmwareApp`, `firmwareVersion`, `firmwareBuildId`, and `firmwareBoard` fields in discovery, instead of creating a second parallel identity model. This preserves compatibility for current query, report, and service consumers.
- Persist the capability set in history as a normalized comma-joined `agentCapabilitySets` list and expose it back out to callers as an array. This keeps history deduplicated while keeping service output convenient for later web and remote consumers.
- Treat the unexpected CP210x serial bridge on `COM7` as a legitimate new-family discovery event and keep the resulting draft profile. The system should learn from surprising bench hardware rather than silently filtering it out.
- Fix the F072 host-build failure in the linker script rather than hiding `printf` or the board-agent helper. The missing `end` symbol was a real bare-metal build gap that should be corrected at the memory-layout layer.

## 2026-03-29 19:30 Europe/London

- Keep Windows serial-port enumeration and USB-registry lookup as separate steps. Port discovery is reliable as a simple list, while descriptor enrichment is easier to debug and evolve as a focused per-device probe.
- Treat registry-backed USB identity as the first stronger STM32-family match layer, even before the composite sibling-function walk is perfect. For the attached Nucleo, `VID_0483`, `PID_374B`, `manufacturer=STMicroelectronics`, and `service=usbser` are already materially stronger than transport-name-only matching.
- Probe known USB-to-UART bridge families non-destructively for MCU identity when the bench hardware suggests an ESP-class target. For now the discovery path promotes CP210x-backed units through esptool and passive serial capture instead of leaving them as anonymous bridge-only cards.
- Prefer promoting an unresolved unit to a MAC-based identity as soon as chip evidence is available, even if that temporarily leaves an older transport-only record in history. Keeping the stronger identity now is better than holding the weaker one; a later reconciliation task can merge superseded records cleanly.

## 2026-03-29 19:45 Europe/London

- Keep USB topology metadata host-derived and descriptive rather than pretending it is a portable physical truth. Windows location strings are still useful for bench workflows even if they are platform-specific.
- Parse Windows USB location information into a small normalized summary with `kind`, `raw`, and `path` fields. This is enough for operators and later UI work without locking the project into a more detailed topology model than the host can prove.
- Prefer parsed slash-separated topology summaries over raw location strings in operator-facing query output. The raw string still belongs in history, but the parsed path is easier to compare across units on the bench.

## 2026-03-29 20:05 Europe/London

- Use host-exposed descriptor fields opportunistically rather than forcing a synthetic schema where Windows does not provide the value. Product name, revision, and driver key are useful now; parent-prefix and enumerator name should remain nullable.
- Derive USB revision from the hardware ID `REV_####` token when present instead of trying to infer it from product names or driver metadata. That mapping is simple, deterministic, and already available in the Windows registry for the current devices.
- Expose richer USB descriptor fields through the shared query contract, not only inside the raw `usbDescriptor` blob. The web UI and remote callers should not need to know the low-level registry shape to use this identity evidence.

- 2026-03-29 19:50 Europe/London: When discovery upgrades a unit from transport-only identity to a stronger identity such as chip MAC, the stronger key becomes canonical and the older key is retained in `identity.priorStableKeys` instead of keeping two physical-unit records.

- 2026-03-29 20:08 Europe/London: Discovery should keep operating when identity evidence disagrees, but it must persist a conflict record with the competing stable keys and the chosen canonical match so later manual override and UI work can resolve it explicitly.

- 2026-03-29 20:22 Europe/London: Manual operator overrides should affect the current effective board/family view and persisted override metadata, but they should not become permanently learned board-identification evidence after the override is cleared.

## 2026-03-29 20:45 Europe/London

- Add reconciliation as an explicit operator action with dry-run support instead of auto-promoting draft families from weak candidate scores. The COM7 ESP32 board has useful hints, but the exact board identity is still uncertain, so merge decisions must stay reviewable and deliberate.
- Preserve draft family provenance after reconciliation by marking the source profile and family as merged into a known board profile rather than deleting them. This keeps the discovery history explainable when heuristics improve over time.
## 2026-03-29 21:05 Europe/London

- Keep retention bounded and local to the Stage 2 history model rather than introducing archival storage yet. The immediate goal is to stop JSON and SQLite growth from becoming unbounded on a long-lived bench, not to design the final archive system.
- Retention should prune rolling observation arrays and the run ledger, but it should not delete current unit/family records. Current bench identity must remain stable even when older low-level observations are trimmed.
## 2026-03-29 21:20 Europe/London

- Keep the shared `/api/query` contract for list-style views, but add direct resource endpoints for raw inventory, history, and profiles. The web UI and remote callers will need both summary queries and direct object models.
- Make the first service-layer APIs read-only JSON endpoints over the persisted Stage 2 files instead of introducing write semantics or job control yet. This keeps the service stable while later milestones add programming and setup actions.
## 2026-03-29 21:40 Europe/London

- Use a plain Node assertion runner instead of `node --test` in this repo’s default test path. The Windows environment here blocks the test runner’s worker-process spawning, but plain Node imports and assertions run reliably.
- Keep the Stage 2 tests focused on pure discovery helpers and service-data readers first. That gives repeatable coverage without requiring live USB enumeration or serial hardware during every validation pass.
- 2026-03-29 22:05 Europe/London: Defined Milestone 3 as validate/build/program/run/debug orchestration instead of only build/flash/debug, because the user needs board-config verification, runtime log capture, and IDE-debug metadata as first-class workflows.
- 2026-03-29 22:05 Europe/London: Chose the Stage 3 validation order as controller first, then controller-owned buses or IP blocks, then configured attached devices, because that mirrors hardware dependencies and produces clearer fault reports.
- 2026-03-29 22:05 Europe/London: Decided that Stage 3 should produce both machine-readable job or report records and human-readable logs, so the same outputs can serve CLI use, service APIs, and the later web UI.
- 2026-03-29 22:25 Europe/London: Put the first Stage 3 state under project/job-manager instead of reusing project/device-manager, because discovery history and operator job execution are separate concerns with different record shapes and retention needs.
- 2026-03-29 22:25 Europe/London: Started Stage 3 with a dependency-free JSON job store and local CLI wrapper so later build, run, and debug flows can attach to stable persisted records before adding service APIs or a heavier database layer.
- 2026-03-29 22:40 Europe/London: Board-only Stage 3 job requests now fail when multiple present units match the same board, because silently choosing one of multiple identical attached units would be unsafe for program, run, and debug actions.
- 2026-03-29 22:40 Europe/London: Stage 3 job resolution reads the current inventory first and history second, because the current bench state must drive actionable jobs while history fills in family and profile context.
- 2026-03-29 22:55 Europe/London: Defined the validation contract as a generated per-board artifact instead of scattered runtime code, because later probe runners, reports, and service APIs need one stable ordered description of the validation phases and checks.
- 2026-03-29 22:55 Europe/London: Reused part-level smoke-test metadata when generating device validation checks so shared part knowledge remains centralized and boards only contribute wiring and local config.
- 2026-03-29 23:05 Europe/London: The first Stage 3 I2C validation runner compares observed scan addresses against the generated contract and treats both missing configured addresses and unexpected observed addresses as validation failures, because either condition means the live board does not match the declared board config cleanly.
- 2026-03-29 23:05 Europe/London: The initial bus-scan evidence format is a simple serial line, `BoardManagerI2CScan: bus=<name> observed=<list>`, because it is cheap to emit from firmware and easy for the host validator to parse before richer board-agent protocols are added.
- 2026-03-29 23:20 Europe/London: The Stage 3 report format now includes raw capture lines alongside parsed evidence so parser gaps or firmware-output timing issues can be debugged without rerunning the board immediately.
- 2026-03-29 23:20 Europe/London: Health is represented as a stable section in the report schema even when current boards do not yet provide voltages or temperatures, so later milestones can add those values without breaking report consumers.
- 2026-03-29 22:19 Europe/London: Stage 3 device validation should reuse machine-readable part validation hooks when available and only fall back to free-text smoke-test checks when a part has no structured hooks. This keeps shared probe intent centralized in the reusable part catalog instead of copying similar checks into each board contract.
- 2026-03-29 22:36 Europe/London: Stage 3 validation reports should merge current Stage 2 identity and firmware state with the live capture window, instead of depending only on the lines seen during one serial session. This keeps reports useful when the board is already running and the capture starts after boot banners or scan lines have already passed.
- 2026-03-29 22:55 Europe/London: Bench sweeps should use the strongest safe test path per attached card instead of forcing every unit through the same validation shape. Known matched boards can use Stage 3 board validation, while unresolved hardware such as COM7 should stop at discovery and identification until a safe board definition exists.

- 2026-03-30 00:25 Europe/London: Treat deployable apps as project metadata, not just app-folder names. One board can legitimately host more than one project profile, and Stage 3 job resolution should carry project and OTA policy explicitly instead of guessing from the board alone.
- 2026-03-30 00:25 Europe/London: Make per-unit OTA signing mandatory for OTA-capable projects and require per-unit AES encryption only for projects marked secure. This keeps standard OTA and secure OTA as explicit project policy variants on the same board definition.

- 2026-03-30 00:45 Europe/London: Keep framework entrypoints thin and stable, and reserve `board_app_user.c` plus `board_app_user.h` inside each project user-code root for project-local logic. This gives build, run, and later OTA tooling a predictable framework boundary without taking control of user code.
- 2026-03-30 17:06 Europe/London: Build orchestration should fail through the Stage 3 job model, not only through shell exit codes. Even when a toolchain is unhealthy, the job store must still capture status, summary, log path, and report path.
- 2026-03-30 17:06 Europe/London: Long-running external tool steps need explicit host-side timeouts in build.ps1. The current Windows environment can hang inside STM32 CMake configure, so bounded timeout handling is preferable to waiting indefinitely for toolchain recovery.
- 2026-03-30 17:06 Europe/London: Failed build jobs should not advertise stale firmware binaries as produced artifacts. On failure, keep the build directory reference and log/report evidence, but reserve detailed artifact lists for successful runs.

- 2026-03-30 17:22 Europe/London: Program orchestration should resolve and record the current transport port from the stable unit id before flashing. The operator targets the physical unit identity; the transient COM port is derived state that belongs in the job result.
- 2026-03-30 17:22 Europe/London: Program jobs should use the same log/report pattern as build jobs, including bounded flash timeouts and normal failed-job records for host-side tool issues. That keeps later service and UI behavior consistent across Stage 3 actions.

- Debug-job orchestration will prepare reproducible launch metadata and reports rather than trying to own a long-lived interactive debugger session. This keeps the Stage 3 runner bounded while still giving CLI and IDE consumers the exact commands and settings they need.
- Stage 3 service APIs will expose log tails and parsed reports rather than arbitrary filesystem reads. This gives the web UI the useful data it needs while keeping the HTTP surface small and stable.
- Stage 3 regression coverage will stay hardware-free by testing validation parsing and job-store transitions with local fixture data rather than requiring live boards for every test run. Live bench checks remain useful, but they are not the default regression gate.

- 2026-03-30 18:45 Europe/London: Structure Milestone 4 around three operator areas: module config, board config, and build/run. That matches the user's workflow better than a generic dashboard-first plan.
- 2026-03-30 18:45 Europe/London: Keep the Stage 4 model explicitly tree-based across the UI and service layer. Modules can contain modules, boards compose modules with local wiring/config, and projects sit on top of one selected board.
- 2026-03-30 18:45 Europe/London: Treat discovery-assisted board creation and manual board creation as equal first-class flows. The system should help with first guesses, but it must not force hardware discovery before a board can be modeled.
- 2026-03-30 18:45 Europe/London: Reuse the existing Stage 2 and Stage 3 APIs where possible, then add targeted write APIs for modules, boards, and projects. The UI should not invent a second separate state model if the service layer can carry it.

- 2026-03-30 19:00 Europe/London: Treat the user-provided M5Stack and Waveshare examples as the first explicit Stage 4 seed set for the known catalog. That gives the catalog and editor work a concrete starting target instead of an abstract import requirement.
- 2026-03-30 19:00 Europe/London: Keep catalog role flexible for the seed data. Some entries should be modeled as standalone boards, some as reusable modules, and some as either depending on assembly context rather than forcing one global type too early.

- 2026-03-30 19:25 Europe/London: Keep the Stage 4 tree model as a generated service-facing artifact under project/web-ui. The UI and later Python service should consume one stable tree snapshot instead of rebuilding module, board, and project trees independently.
- 2026-03-30 19:25 Europe/London: Treat the current Node HTTP service as transitional for Stage 4. The long-term Milestone 4 web host should be Python-based, but it can consume JSON generated by existing dependency-light Node scripts during the migration.

- 2026-03-30 20:05 Europe/London: Put the first Stage 4 read-only API on Python now instead of extending the Node HTTP service again. That aligns the implementation path with the user's stated runtime preference before the web UI is built on top.
- 2026-03-30 20:05 Europe/London: Serve linked local help content through the same Python API surface as the module, board, and project trees. The later web UI should not need a second filesystem-specific path just to render part and board help pages.

- 2026-03-30 20:15 Europe/London: Ignore Python cache folders and .pyc files repo-wide now that Stage 4 includes Python tooling. These are runtime byproducts, not tracked project state.

- 2026-03-30 20:30 Europe/London: Use the existing Python Stage 4 server as the first shell host instead of introducing a separate frontend runtime immediately. That keeps Milestone 4 aligned with the Python web-server requirement and reduces early stack sprawl.
- 2026-03-30 20:30 Europe/London: Treat inventory, jobs, and reports as reserved shell sections now even before their full view logic exists. Locking the navigation shape early makes later UI tasks less disruptive.

- 2026-03-30 20:50 Europe/London: Keep the inventory dashboard as an aggregated Python endpoint instead of making the browser stitch together raw Stage 2 and Stage 3 sources itself. The UI should consume one operator-facing bench summary contract.
- 2026-03-30 20:50 Europe/London: Validate the inventory dashboard by importing the Python module directly when localhost process-launch checks are blocked by the Windows sandbox. That still proves the payload logic against real repo data without pretending the blocked runner path succeeded.

- 2026-03-30 21:20 Europe/London: Keep the module catalog as an aggregated Python endpoint instead of making the browser derive vendor, role, help-reference, and composition summaries from the raw tree model itself. This keeps the Modules view thin and gives later write flows one stable read contract for catalog-focused UI work.

- 2026-03-30 21:45 Europe/London: Keep module help as a per-module Python payload that bundles references, declared high-level API, default config, and local markdown content. This keeps the shell simple and lets later editors reuse one stable read contract for module detail views.

- 2026-03-30 22:00 Europe/London: If a module does not have one defensible datasheet URL, omit the datasheet reference instead of pointing the datasheet field at a product or board page. Wrong links are worse than an intentionally missing datasheet entry in the Stage 4 help UI.

- 2026-03-30 22:25 Europe/London: Start Stage 4 write support with one narrow module-create action rather than a generic module CRUD API. That keeps the current task bounded while still making the browser flow real and leaves broader update safety rules for the next service-write task.

- 2026-03-30 23:15 Europe/London: Keep composed-module creation as a narrow Python service write flow with explicit child-module rows and module-level default config, instead of waiting for a full generic module-update API. This completes the current editor task without overreaching into the next service-write milestone.
- 2026-03-30 23:15 Europe/London: Normalize older composition metadata shapes into `composition.children` at tree-generation and help-payload time. Existing catalog entries such as `m5_module_gnss` should appear correctly in the UI even before every source part file is rewritten to the latest composition shape.
- 2026-03-30 23:15 Europe/London: Treat direct composed-module create/cleanup execution as optional validation on this host when AV or Windows policy interferes, and rely on syntax checks plus standard repo validation as the hard gate. This keeps the task moving without forcing more temp-script churn on the machine.
- 2026-03-30 23:40 Europe/London: Keep Stage 4 module updates guarded to `origin: user` modules only. Seeded catalog modules are project-owned reference data and should not be editable through the first generic write API.
- 2026-03-30 23:40 Europe/London: Add a dedicated module-edit payload endpoint instead of making the browser reconstruct editable values from the help payload. This keeps later module-editor UI work simpler and avoids coupling the write form to presentation-oriented help responses.
- 2026-03-31 00:05 Europe/London: Put module-definition validation in the Python service and reuse it for create, compose, and update flows. The browser should not duplicate validation rules that the write layer also depends on.
- 2026-03-31 00:05 Europe/London: Return both errors and warnings from module validation. Some checks, such as missing generated help markdown or a missing typical I2C address, should not block writes but still matter to operators.
- 2026-03-31 00:35 Europe/London: Keep the Boards tab on aggregated Python payloads instead of making the browser derive board assembly detail from the raw Stage 4 tree by itself. This matches the inventory and module views and keeps later board-edit work pointed at one stable board-facing contract.
- 2026-03-31 00:35 Europe/London: Surface generated board artifacts in the board-detail payload when matching `project/generated/<boardId>.h` and `.c` files exist. The board catalog should connect the UI back to the generated firmware API without requiring another file-walk endpoint.
- 2026-03-31 01:05 Europe/London: Build the first discovery-assisted board-create flow from the current Stage 2 inventory and family profiles instead of inventing a separate board-draft store. The guess should come from the same observed unit and profile evidence that the rest of the system already trusts.
- 2026-03-31 01:05 Europe/London: When a discovered unit already matches a known board or has a strong candidate board, seed the draft by cloning that board definition. Only fall back to a minimal generic board skeleton when no known board shape exists.
- 2026-03-31 01:25 Europe/London: Keep manual board creation as two narrow paths: blank-board plus controller selection, or template-backed cloning from an existing board definition. This satisfies the manual-create requirement without pre-solving the later full board-editor task.
- 2026-03-31 01:25 Europe/London: Require a controller module for blank manual boards so the resulting draft always starts from a valid board skeleton with a usable boot-sequence root.
