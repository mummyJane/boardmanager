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
