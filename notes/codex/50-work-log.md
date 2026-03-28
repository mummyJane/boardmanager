# Work Log

## 2026-03-28 14:30 Europe/London

Commands run:

- `Get-ChildItem -Force`
- `Get-Content AGENTS.md`
- `git status --short --branch` -> failed because the repo was not initialized
- `rg --files`
- `New-Item -ItemType Directory -Force notes\\codex,project,project\\boards,project\\generated,project\\scripts,project\\web,project\\device-manager,project\\firmware-common,install,update,keys`
- `node --version`
- `node project/scripts/generate-board-artifacts.mjs`
- `Get-ChildItem project/generated -File | Select-Object Name`
- `git init`
- `git checkout -b codex/bootstrap`
- `git add .`
- `git commit -m "Bootstrap Board Manager milestone 1"`
- `git tag Task_bootstrap_1`
- `git remote -v`
- `Get-Content notes/codex/10-spec.md`
- `node project/scripts/generate-board-artifacts.mjs` after adding M5Stack Dial board definition
- `Get-Content project/generated/m5stack_dial_v1_1.h`
- `Get-Content project/generated/m5stack_dial_v1_1.c`
- `git push origin codex/bootstrap --follow-tags`
- `git push origin Task_bootstrap_1 Task_m5stack_dial_1`
- `node project/scripts/generate-board-artifacts.mjs` after adding reusable part resolution
- `node project/scripts/generate-board-artifacts.mjs` after removing parent-directory includes from generated headers
- `Get-ChildItem project/generated -Filter *.h | Select-String '\.\./'`
- `node project/scripts/generate-board-artifacts.mjs` after adding boot sequence generation and SDK mapping
- `Get-Content project/generated/m5stack_dial_v1_1.c -Raw`
- `Get-Content project/generated/stm32_nucleo_io_v1.c`

Observed issues:

- required files under `notes/codex` did not exist at bootstrap time
- repository was not a git repository initially
- `apply_patch` failed in the Windows sandbox, so file creation was done with PowerShell `Set-Content`
- generated artifacts were briefly excluded in `.gitignore`; this was corrected so generated outputs can be committed and reviewed
- git reported line-ending normalization warnings for newly staged files on Windows
- initial generator rerun output did not show the new board on the first pass; rerunning completed cleanly and produced the expected files
- pushing to GitHub required escalated permissions because the sandbox could not complete credential prompting
- an initial broad `rg` search matched the generator script path logic as well as stale generated content; direct header inspection confirmed the generated include lines were corrected
- one read of `m5stack_dial_v1_1.c` returned older content while the raw file view showed the updated generated boot sequence; subsequent verification used raw file reads for the generated source

Actions:

- created initial repository directory structure
- established documentation files required by `AGENTS.md`
- added sample board definitions for ESP32 and STM32 targets
- added a Node.js generator for board headers and source stubs
- added shared firmware API header and milestone install/update scripts
- initialized git and created branch `codex/bootstrap`
- confirmed the GitHub remote is linked and pushed current work
- added a concrete M5Stack Dial V1.1 board definition based on official docs and pin map
- extended the board schema documentation to include buses, connectors, reusable parts, and project-level overrides
- added reusable part definitions for MCU, package, module, and attached devices
- refactored the generator to resolve boards through reusable parts
- added a project-level override example for the M5Stack Dial
- removed `..` include paths from generated headers so include resolution is handled by the build system
- added generated boot/setup stubs and platform SDK mapping for board initialization

Validation:

- `node --version` -> `v23.6.0`
- initial `node project/scripts/generate-board-artifacts.mjs` -> success; generated 4 files under `project/generated`
- current `node project/scripts/generate-board-artifacts.mjs` -> success; generated artifacts for esp32 sample, M5Stack Dial V1.1, and stm32 sample boards using resolved part metadata
- `Get-ChildItem project/generated -Filter *.h | Select-String '\.\./'` -> no matches
- `Get-Content project/generated/m5stack_dial_v1_1.c -Raw` -> board init contains ordered controller/bus/device/signal boot stubs for `esp-idf`
- `Get-Content project/generated/stm32_nucleo_io_v1.c` -> board descriptor now includes platform SDK `stm32cube`

## 2026-03-28 15:36 Europe/London

Commands run:

- `install-tools.ps1 -Platform esp32`
- `git status --short --ignored`

Observed issues:

- local SDK and toolchain downloads under `project/toolchains` and `project/tools` should not be committed

Actions:

- updated `.gitignore` to exclude local toolchains, downloaded tools, downloads cache, and build output directories under `project/`

## 2026-03-28 15:41 Europe/London

Commands run:

- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`

Observed issues:

- `idf.py` failed inside the Windows sandbox with `PermissionError: [WinError 5] Access is denied` while spawning CMake via Python asyncio subprocess handling
- `build.ps1` reported success because it did not yet convert non-zero `idf.py` exit codes into terminating errors

Actions:

- updated `build.ps1` to fail hard when `idf.py` returns a non-zero exit code
- preparing to rerun the build outside the sandbox because this failure blocks validation and appears to be sandbox-related

## 2026-03-28 15:49 Europe/London

Commands run:

- `install-tools.ps1 -Platform stm32`
- `install-tools.ps1 -Platform esp32`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`

Observed issues:

- first ESP32 build attempt failed in the sandbox with `PermissionError: [WinError 5] Access is denied` during `idf.py` subprocess creation
- `build.ps1` initially treated a failing `idf.py` invocation as success and needed explicit exit-code handling
- STM32 local tooling is scaffolded only; automated download/install is not implemented yet

Actions:

- added local-tooling layout under `project/` for SDKs, tools, downloads, apps, and build output
- added top-level `install-tools.ps1`, `build.ps1`, `clean.ps1`, and `program.ps1` wrappers that self-manage environment setup
- added `project/scripts/common.ps1` for process-local env setup and cleanup
- added a minimal ESP-IDF app under `project/apps/m5stack_dial_demo`
- installed ESP-IDF locally under `project/toolchains/esp-idf/esp-idf` and its downloaded tools under `project/tools/espressif`
- reran the build outside the sandbox and completed a successful ESP32 build test

Validation:

- `install-tools.ps1 -Platform stm32` -> scaffolded STM32 local tooling placeholder
- `install-tools.ps1 -Platform esp32` -> success; local ESP-IDF and toolchain installed under `project/`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success; build outputs generated under `project/build/esp32-m5stack_dial_demo`

## 2026-03-28 15:53 Europe/London

Commands run:

- `git status --short --ignored`

Observed issues:

- local workspace and generated ESP-IDF `sdkconfig` files remained untracked after the first build pass

Actions:

- updated `.gitignore` to exclude `*.code-workspace`, `project/apps/*/sdkconfig`, and `project/apps/*/sdkconfig.old`
