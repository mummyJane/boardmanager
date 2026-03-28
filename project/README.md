# Local Tooling Layout

All project-managed SDKs, toolchains, downloads, and build outputs live under `project/`.

## Directories

- `project/toolchains/esp-idf/esp-idf`: local ESP-IDF checkout
- `project/toolchains/stm32cube/STM32CubeF4`: local STM32CubeF4 firmware package checkout
- `project/toolchains/arm-gnu-toolchain` or `project/toolchains`: local Arm bare-metal compiler toolchain, depending on archive layout
- `project/tools/espressif`: local ESP-IDF downloaded tool binaries
- `project/downloads`: cached installers and archives
- `project/build`: out-of-tree build directories
- `project/apps`: firmware applications driven by CMake-based SDKs

## Current Apps

- `project/apps/m5stack_dial_demo`: ESP-IDF demo app for the M5Stack Dial
- `project/apps/stm32_nucleo_io_demo`: STM32Cube-based demo app for the STM32 sample board

## Top-Level Scripts

- `install-tools.ps1`: install or scaffold local SDK/toolchain dependencies
- `build.ps1`: generate board artifacts, setup SDK env, and build
- `program.ps1`: setup SDK env and flash a selected unit
- `clean.ps1`: remove local build outputs

These scripts manage process-local environment variables internally and do not require the caller to pre-source any SDK environment.
