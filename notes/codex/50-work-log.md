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
