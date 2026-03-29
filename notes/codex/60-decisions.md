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
