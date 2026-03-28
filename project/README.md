# Local Tooling Layout

All project-managed SDKs, toolchains, downloads, and build outputs live under `project/`.

## Directories

- `project/toolchains/esp-idf/esp-idf`: local ESP-IDF checkout
- `project/toolchains/stm32cube`: local STM32 tool root
- `project/tools/espressif`: local ESP-IDF downloaded tool binaries
- `project/downloads`: cached installers and archives
- `project/build`: out-of-tree build directories
- `project/apps`: firmware applications driven by CMake-based SDKs

## Top-Level Scripts

- `install-tools.ps1`: install or scaffold local SDK/toolchain dependencies
- `build.ps1`: generate board artifacts, setup SDK env, and build
- `program.ps1`: setup SDK env and flash a selected unit
- `clean.ps1`: remove local build outputs

These scripts manage process-local environment variables internally and do not require the caller to pre-source any SDK environment.
