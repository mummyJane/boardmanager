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

Observed issues:

- required files under `notes/codex` did not exist
- repository was not a git repository yet
- `apply_patch` failed in the Windows sandbox, so file creation was done with PowerShell `Set-Content`
- generated artifacts were briefly excluded in `.gitignore`; this was corrected so generated outputs can be committed and reviewed
- git reported line-ending normalization warnings for newly staged files on Windows

Actions:

- created initial repository directory structure
- established documentation files required by `AGENTS.md`
- added sample board definitions for ESP32 and STM32 targets
- added a Node.js generator for board headers and source stubs
- added shared firmware API header and milestone install/update scripts
- initialized git and created branch `codex/bootstrap`

Validation:

- `node --version` -> `v23.6.0`
- `node project/scripts/generate-board-artifacts.mjs` -> success; generated 4 files under `project/generated`
