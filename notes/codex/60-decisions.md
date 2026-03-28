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
