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

## 2026-03-28 16:00 Europe/London

Commands run:

- `Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Description`

Observed issues:

- serial port enumeration is blocked in the sandbox with `Access denied`, so direct port verification from the local environment requires elevated execution

Actions:

- using user-provided `COM3` as the candidate M5Stack Dial target for program-flow validation
- updated `program.ps1` to fail hard on non-zero `idf.py flash` exit codes

## 2026-03-28 16:03 Europe/London

Commands run:

- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM3`

Validation:

- `program.ps1 ... -Unit COM3` -> success; flashed bootloader, partition table, and app image to an ESP32-S3 device on `COM3`
- esptool identified the target as `ESP32-S3 (QFN56)` with embedded `8MB` flash using `USB-Serial/JTAG`

## 2026-03-28 16:10 Europe/London

Commands run:

- `validate.ps1`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`

Actions:

- added `project/scripts/validate-definitions.mjs` to validate parts, boards, and projects
- added `validate.ps1` as a top-level validation entry point
- wired validation into `build.ps1` and `program.ps1` so invalid metadata fails before build or flash

Validation:

- `validate.ps1` -> success; validated 7 parts, 3 boards, and 1 projects
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success with validation gate enabled

## 2026-03-28 16:16 Europe/London

Commands run:

- `validate.ps1`
- `node project/scripts/generate-board-artifacts.mjs`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`

Actions:

- added reusable ESP32 and STM32 sample parts for the remaining generic boards
- converted `esp32_dev_relay_v1` and `stm32_nucleo_io_v1` from legacy flat board definitions to controller-based board assemblies
- regenerated firmware artifacts using the unified schema path for all boards

Validation:

- `validate.ps1` -> success; validated 13 parts, 3 boards, and 1 projects
- `node project/scripts/generate-board-artifacts.mjs` -> success; regenerated all board artifacts using the unified model
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success after converting the sample boards

## 2026-03-28 16:31 Europe/London

Commands run:

- `git status --short --branch`
- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/scripts/generate-board-artifacts.mjs`
- `Get-Content project/apps/m5stack_dial_demo/components/board_manager_generated/CMakeLists.txt`
- `Get-ChildItem -Recurse project/platform | Select-Object FullName`
- `Get-Content project/platform/esp-idf/m5stack_dial_v1_1_platform.c`
- `Get-Content project/platform/esp-idf/esp32_dev_relay_v1_platform.c`
- `Get-Content project/platform/stm32cube/stm32_nucleo_io_v1_platform.c`
- `Get-Content project/platform/README.md`
- `Get-Content project/boards/m5stack_dial_v1_1.json`
- `node project/scripts/generate-board-artifacts.mjs`
- `validate.ps1`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`
- `Get-Content project/platform/esp-idf/m5stack_dial_v1_1_platform.c | Select-Object -First 40`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` after fixing the missing forward declaration

Observed issues:

- the new ESP-IDF platform implementation initially failed to compile because `m5stack_dial_v1_1_platform_rfid_reset_set` was called before it was declared, and the compiler treated that as an error
- the first concrete Dial platform implementation currently shares GPIO8 as the reset/control line referenced by both the RFID and display metadata, matching the present board definition but still worth revisiting when the device-level model is refined

Actions:

- changed generated board source files so boot and IO functions delegate through stable platform hook symbols instead of leaving TODO bodies in generated code
- added hand-written concrete platform implementations for `m5stack_dial_v1_1`, `esp32_dev_relay_v1`, and `stm32_nucleo_io_v1` under `project/platform/`
- wired the `m5stack_dial_demo` ESP-IDF component to compile the concrete M5Stack Dial platform implementation alongside the generated board source
- fixed the ESP-IDF Dial platform source by adding an explicit forward declaration for the reset helper and removing the unused conversion helper
- added install/update milestone wrappers for the concrete-platform release and pointed `latest` at that release

Validation:

- `validate.ps1` -> success; validated 13 parts, 3 boards, and 1 projects
- first `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> failed as expected on the missing forward declaration in `m5stack_dial_v1_1_platform.c`
- second `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success; concrete ESP-IDF platform layer compiled and linked into `m5stack_dial_demo` under `project/build/esp32-m5stack_dial_demo`

## 2026-03-28 19:58 Europe/London

Commands run:

- `git ls-remote --tags https://github.com/STMicroelectronics/STM32CubeF4.git`
- `install-tools.ps1 -Platform stm32`
- `build.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1`
- `clean.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1`
- `git clone --depth 1 --branch v1.28.3 https://github.com/STMicroelectronics/STM32CubeF4.git project/toolchains/stm32cube/STM32CubeF4`
- `git -C project/toolchains/stm32cube/STM32CubeF4 submodule update --init --depth 1 Drivers/STM32F4xx_HAL_Driver Drivers/CMSIS/Device/ST/STM32F4xx`
- repeated `build.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1` after fixing the CMake toolchain path handling, HAL config macros, and generated `NULL` include
- final `install-tools.ps1 -Platform stm32` verification after the script updates

Observed issues:

- the Arm GNU toolchain archive unpacked directly into `project/toolchains` instead of a versioned subfolder, and the original post-extract move step failed
- the initial STM32CubeF4 checkout was present as an empty directory until the SDK clone was repaired manually
- Windows antivirus likely interfered with the large archive move/extract workflow, so the STM32 install path needed to avoid aggressive rename steps
- CMake toolchain discovery on Windows required explicit `.exe` tool paths and local auto-discovery to survive `try_compile`
- the STM32Cube HAL integration initially failed on missing `assert_param`, timeout macros, and `NULL` in generated board sources

Actions:

- added a local Arm bare-metal toolchain path and STM32 SDK environment handling to `project/scripts/common.ps1`
- extended `install-tools.ps1` to install the STM32CubeF4 SDK and local Arm GNU toolchain under `project/`, and to fetch the required STM32Cube submodules for the sample build
- added the `project/cmake/toolchains/arm-none-eabi.cmake` toolchain file and a new `project/apps/stm32_nucleo_io_demo` CMake app
- updated the generator to include `<stddef.h>` in generated C sources so `NULL` is defined for descriptor entries
- updated the STM32 HAL config header with the minimum timeout, external clock, and `assert_param` definitions required by the HAL sources
- kept the STM32 validation flow host-side only because no physical STM32 board is currently available

Validation:

- `install-tools.ps1 -Platform stm32` -> success after the AV-friendly install-path adjustments; confirmed the local STM32CubeF4 SDK and Arm GNU toolchain are available under `project/`
- `build.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1` -> success; produced `project/build/stm32-stm32_nucleo_io_demo/stm32_nucleo_io_demo.elf` and `.bin`
- the successful STM32 link still reports expected `nosys` warnings for `_close`, `_lseek`, `_read`, and `_write`; those do not block the host-side firmware build test

## 2026-03-28 20:10 Europe/London

Commands run:

- `Get-Content project/apps/m5stack_dial_demo/main/app_main.c`
- `Get-Content project/platform/esp-idf/m5stack_dial_v1_1_platform.c`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM3`
- serial capture from `COM3` using the local ESP-IDF Python environment before and after a manual RTS reset

Observed issues:

- the first serial capture attached after boot and only showed the steady-state live input logs, so a second reset-and-capture pass was needed to collect the startup self-test summary
- the physical Dial board responded on the controller/display paths, but the RTC, touch, and RFID devices all timed out during the current I2C smoke-test run

Actions:

- added a public Dial platform self-test header and diagnostic getter for app-level smoke tests
- updated the Dial ESP-IDF platform implementation so peripheral presence is recorded and logged instead of aborting the entire board init on probe failures
- changed the Dial demo app into a smoke-test app that prints a board summary, exercises the backlight and buzzer, and reports live input states once per second
- flashed the updated smoke-test firmware to the Dial on `COM3`

Validation:

- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM3` -> success
- boot-time smoke-test output on `COM3` reported controller GPIO `PASS`, internal I2C setup `PASS`, display SPI `PASS`, display command path `PASS`, and `FAIL` for RTC, touch, and RFID I2C presence during this run
- live input logs reported `touch_irq=0 rfid_irq=0 enc_a=1 enc_b=1` repeatedly after boot on the current board state

## 2026-03-28 20:18 Europe/London

Commands run:

- Get-Content project/parts/devices/bm8563.json`r
- Get-Content project/parts/README.md`r
- updated 
otes/codex/10-spec.md, 
otes/codex/30-tasks.md, 
otes/codex/40-context.md, 
otes/codex/60-decisions.md, and 
otes/codex/70-spec-update.md`r
- added project/help/parts/bm8563.md`r
- updated project/parts/devices/bm8563.json and project/parts/README.md`r

Actions:

- documented that reusable parts own init/setup contracts, smoke-test meaning, and high-level API shape
- added a first per-part help/man page for m8563 with datasheet, website, and API-usage guidance
- added future task-tracker items for reusable part-level APIs/smoke tests and for per-part help/man page coverage


## 2026-03-29 09:19 Europe/London

Commands run:

- `git status --short --branch`
- `Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Description,PNPDeviceID`
- local ESP-IDF Python `esptool.py --chip esp32s3 -p COM4 read_mac`
- local ESP-IDF Python `esptool.py --chip esp32s3 -p COM5 read_mac`
- serial capture from `COM5` before reflashing using the local ESP-IDF Python environment
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM5`
- serial reset-and-capture from `COM5` after reflashing using the local ESP-IDF Python environment

Observed issues:

- all connected ESP32-S3 units currently enumerate under the same Espressif USB VID/PID, so port selection cannot rely on VID/PID alone
- `COM4` has only been fingerprinted by MAC and ROM boot output so far; no app-level self-identification has been captured yet
- the pre-flash `COM5` factory image and the existing `COM3` smoke-test image show different peripheral behavior, which will matter when the reusable part-level smoke-test work starts

Actions:

- enumerated `COM3`, `COM4`, and `COM5` together to establish the current multi-unit USB state
- captured MAC `48:27:e2:66:b0:04` from `COM4` and MAC `c0:4e:30:12:b3:e0` from `COM5`
- captured a factory-test boot log from `COM5` showing project `stamp_ring_factory_test`, encoder init, and live I2C addresses `0x28`, `0x38`, and `0x51`
- flashed only `COM5` with the Board Manager `m5stack_dial_demo` image while other units remained connected
- captured post-flash serial output from `COM5` showing the Board Manager live input stream on the same port
- updated task, context, decision, and release-wrapper docs for the multi-unit programming milestone

Validation:

- `Get-CimInstance Win32_SerialPort ...` -> success; `COM3`, `COM4`, and `COM5` all present concurrently with distinct USB instance paths
- `esptool.py --chip esp32s3 -p COM4 read_mac` -> success; MAC `48:27:e2:66:b0:04`
- `esptool.py --chip esp32s3 -p COM5 read_mac` -> success; MAC `c0:4e:30:12:b3:e0`
- pre-flash serial capture on `COM5` -> success; observed factory image `stamp_ring_factory_test` plus I2C activity at `0x28`, `0x38`, and `0x51`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM5` -> success; targeted flash completed with `COM3`, `COM4`, and `COM5` connected
- post-flash serial capture on `COM5` -> success; observed repeated `Live inputs: touch_irq=0 rfid_irq=0 enc_a=1 enc_b=1` from the Board Manager app on the same port

## 2026-03-29 09:24 Europe/London

Commands run:

- `Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name,Description,PNPDeviceID`

Actions:

- confirmed the current attached bench inventory as `COM3` = M5Stack Dial, `COM4` = M5Stack CoreS3 with battery and GNSS, `COM5` = M5Stack Dial, and `COM6` = P-NUCLEO-USB001 / Nucleo-F072RB
- recorded the newly attached STM32 board as current Stage 2 discovery context

Validation:

- `Get-CimInstance Win32_SerialPort ...` -> success; `COM6` enumerates as `STMicroelectronics STLink Virtual COM Port`, consistent with the attached Nucleo board

## 2026-03-29 09:55 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/20-plan.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-ChildItem -Recurse project/boards,project/parts,project/help | Select-Object FullName`
- `Get-Content project/scripts/generate-board-artifacts.mjs`
- `Get-Content project/scripts/validate-definitions.mjs`
- updated reusable part JSON files for existing Dial devices plus added new CoreS3, GNSS, STM32F072, and USB PD part files
- added board JSON files for `m5stack_cores3_gnss_v1` and `p_nucleo_usb001_f072rb_v1`
- added new project metadata, platform stubs, help/man pages, and updated readmes under `project/`
- `node project/scripts/generate-board-artifacts.mjs`
- `validate.ps1`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`
- `build.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1`

Observed issues:

- the Windows sandbox `apply_patch` path failed again, so file edits were completed with PowerShell `Set-Content`
- the current schema does not yet support true nested accessory-module composition, so the physical CoreS3 + GNSS stack is represented as a concrete board assembly for now
- the new CoreS3 + GNSS and P-NUCLEO board platform files are scaffolds and metadata coverage only; there are not yet dedicated buildable demo apps for those new boards

Actions:

- expanded reusable part metadata to include init contracts, smoke-test meaning, high-level API shape, docs links, and local help references
- added reusable parts for the CoreS3 controller, AXP2101 PMU, NEO-M9N, M5 GNSS module, STM32F072 MCU, Nucleo-F072RB controller, and STUSB4761
- added concrete board assemblies for the attached CoreS3 + GNSS and P-NUCLEO-USB001 bench units
- added project-level override examples for the new boards
- generated headers and C wrappers for all five board definitions now present in the repo
- added ESP-IDF and STM32Cube platform-side stubs for the new boards
- added board help pages for the current real boards and part help pages for the shared Dial, PMU, GNSS, and USB PD parts
- updated the spec, context, task tracker, decisions, and spec-update notes to reflect the expanded attached-board coverage and richer reusable part metadata

Validation:

- `node project/scripts/generate-board-artifacts.mjs` -> success; generated artifacts for 5 boards including `m5stack_cores3_gnss_v1` and `p_nucleo_usb001_f072rb_v1`
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success after the metadata expansion and new board additions
- `build.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1` -> success with the expected bare-metal `nosys` linker warnings still present

## 2026-03-29 11:40 Europe/London

Commands run:

- small in-repo edits to `build.ps1`, `program.ps1`, `project/scripts/common.ps1`, `install-tools.ps1`, and `project/README.md`
- added `project/apps/m5stack_cores3_gnss_demo/*`
- `build.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1`
- `program.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit COM4`
- serial capture from `COM4` using the local ESP-IDF Python environment after flashing the new CoreS3 app
- added `project/apps/p_nucleo_usb001_demo/*`
- `install-tools.ps1 -Platform stm32`
- repaired an empty `STM32CubeF0` checkout by recloning it locally
- repeated `build.ps1 -Platform stm32 -App p_nucleo_usb001_demo -Board p_nucleo_usb001_f072rb_v1` after fixing the missing F0 CMake argument, HAL clock define, and linker script symbols

Observed issues:

- Windows antivirus and sandboxing continued to interfere with broad write operations and some escalated process launches, so the remaining Milestone 1 work had to be completed in small targeted steps
- the first STM32CubeF0 install attempt failed because the initial checkout was empty and the script incorrectly assumed F0 used the same submodule layout as F4
- the first F072 build attempt failed because `build.ps1` did not yet pass `STM32CUBE_F0_ROOT`
- the second F072 build attempt failed because the F0 HAL config was missing `HSI48_VALUE`
- the third F072 build attempt failed because the initial local linker script did not define `_sidata` correctly

Actions:

- made the ESP-IDF generated component select the board source and platform file via `BOARD_MANAGER_BOARD`
- added a dedicated CoreS3 + GNSS ESP-IDF demo app and validated it on real hardware at `COM4`
- added a dedicated P-NUCLEO-USB001 / F072 STM32 demo app
- extended the local STM32 bootstrap and environment helpers to include STM32CubeF0 alongside STM32CubeF4
- repaired the local STM32CubeF0 checkout and completed the host-side F072 build validation
- updated milestone planning and task tracking to mark Milestone 1 complete

Validation:

- `build.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1` -> success
- `program.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit COM4` -> success; flashed the CoreS3 unit identified by MAC `48:27:e2:66:b0:04`
- post-flash serial capture on `COM4` -> success; observed repeated `Live GNSS PPS state: 0`
- `install-tools.ps1 -Platform stm32` -> success after repairing the local STM32CubeF0 checkout
- `build.ps1 -Platform stm32 -App p_nucleo_usb001_demo -Board p_nucleo_usb001_f072rb_v1` -> success; produced `project/build/stm32-p_nucleo_usb001_demo/p_nucleo_usb001_demo.elf` and `.bin`

## 2026-03-29 14:07 Europe/London

Commands run:

- added `project/device-manager/schema/device-inventory.schema.json`
- added `project/device-manager/data/inventory.json`
- updated `project/device-manager/README.md`
- added `project/scripts/discover-units.mjs`
- added top-level `discover.ps1`
- `discover.ps1`

Actions:

- created the first persisted discovery schema and local inventory store under `project/device-manager`
- implemented a Windows-focused discovery script that enumerates serial ports, captures USB identity, reads short ESP32 firmware signatures, and applies initial board-matching heuristics
- captured and persisted the first matched discovery snapshot for the current four-unit bench

Validation:

- `discover.ps1` -> success; discovered 4 units and matched `COM3`/`COM5` to `m5stack_dial_v1_1`, `COM4` to `m5stack_cores3_gnss_v1`, and `COM6` to `p_nucleo_usb001_f072rb_v1`
- `project/device-manager/data/inventory.json` -> updated with the latest generated discovery snapshot and current match reasons

## 2026-03-29 14:19 Europe/London

Commands run:

- `git status --short --branch`
- `Get-Content project/device-manager/README.md`
- `Get-Content project/device-manager/schema/device-inventory.schema.json`
- `discover.ps1`
- `Get-Content project/device-manager/data/inventory.json`
- `Get-Content project/scripts/discover-units.mjs`
- updated `project/scripts/discover-units.mjs`, `project/device-manager/README.md`, and `project/device-manager/schema/device-inventory.schema.json`
- repeated `discover.ps1` after tightening firmware-signature matching

Observed issues:

- the first stable-identity discovery pass preserved MAC-backed unit IDs, but `COM3` remained unmatched because the current boot banner was classified too generically as a Board Manager boot banner
- identical ESP32 boards cannot be tracked safely by COM port alone because port assignment can change across replug events

Actions:

- extended the persisted inventory schema with an explicit `identity` object containing stable key, USB instance path, MAC, serial-like value, and aliases
- updated the discovery README to document the stable identity priority order for identical attached boards
- updated the discovery script to preserve prior identity evidence across runs and derive stable unit IDs from MAC, USB instance path, serial-like value, or port fallback
- tightened firmware-signature matching so the Dial and CoreS3 boot banners map back to the correct board definitions without relying on port names

Validation:

- `discover.ps1` first rerun -> success; discovered 4 units and assigned MAC-backed stable keys to the ESP32 units, but left `COM3` unmatched because the current banner heuristic was too generic
- second `discover.ps1` rerun after the heuristic fix -> success; matched `COM3` and `COM5` to `m5stack_dial_v1_1`, `COM4` to `m5stack_cores3_gnss_v1`, and `COM6` to `p_nucleo_usb001_f072rb_v1` while keeping the two Dials distinct as `mac:c0:4e:30:13:2b:68` and `mac:c0:4e:30:12:b3:e0`


## 2026-03-29 14:45 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/20-plan.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/device-manager/README.md`
- `Get-Content project/device-manager/data/inventory.json`
- `Get-Content project/scripts/discover-units.mjs`
- updated `project/device-manager/README.md`, `project/device-manager/schema/device-inventory.schema.json`, `project/device-manager/schema/unit-history.schema.json`, `project/device-manager/schema/family-profile.schema.json`, `project/device-manager/data/unit-history.json`, and `project/scripts/discover-units.mjs`
- `discover.ps1`
- `Get-Content project/device-manager/data/unit-history.json`
- `Get-ChildItem project/device-manager/profiles | Select-Object Name`
- repeated `discover.ps1` to validate known-unit matching

Observed issues:

- the previous discovery slice only preserved the latest snapshot, so there was no durable distinction between a known physical unit and a newly attached unit of a known board type
- the first history-populating pass necessarily reports the first members of each family as `new-family`, because no persisted family history exists yet before that run

Actions:

- added persisted history and profile schemas under `project/device-manager/schema`
- added `project/device-manager/data/unit-history.json` as the cumulative Stage 2 store for physical units and board families
- extended the discovery script to maintain per-unit history, per-family history, and generated family profile files
- added classification logic for `known-unit`, `known-family`, and `new-family` outcomes
- made discovery create or update draft family profile files under `project/device-manager/profiles` when a family is first observed

Validation:

- first `discover.ps1` rerun -> success; populated cumulative history and classified `COM3`, `COM4`, and `COM6` as `new-family`, with `COM5` as `known-family` because the Dial family had already been seen earlier in the same run
- second `discover.ps1` rerun -> success; classified `COM3`, `COM4`, `COM5`, and `COM6` as `known-unit` from stable identity history
- generated profile files exist for the currently observed families: `board_m5stack_dial_v1_1.json`, `board_m5stack_cores3_gnss_v1.json`, and `board_p_nucleo_usb001_f072rb_v1.json`


## 2026-03-29 15:05 Europe/London

Commands run:

- `Get-Content project/scripts/discover-units.mjs`
- `Get-ChildItem project/boards | Select-Object Name`
- `Get-Content project/boards/m5stack_dial_v1_1.json`
- `Get-Content project/boards/m5stack_cores3_gnss_v1.json`
- `Get-Content project/boards/p_nucleo_usb001_f072rb_v1.json`
- added `project/scripts/discovery-board-catalog.mjs`
- updated `project/scripts/discover-units.mjs`, `project/device-manager/schema/family-profile.schema.json`, and `project/device-manager/README.md`
- `discover.ps1`
- fixed a literal escape-sequence formatting mistake in `project/scripts/discover-units.mjs`
- repeated `discover.ps1` after the fix
- `Get-Content project/device-manager/profiles/board_m5stack_dial_v1_1.json`
- `Get-Content project/device-manager/profiles/board_m5stack_cores3_gnss_v1.json`
- `Get-Content project/device-manager/profiles/board_p_nucleo_usb001_f072rb_v1.json`
- `validate.ps1`

Observed issues:

- the first attempt to rerun discovery failed because a PowerShell text replacement inserted a literal `` `r`n `` into the import section of `project/scripts/discover-units.mjs`
- the existing family profile format only stored raw fingerprints, which was not enough to help an operator decide which known board definition a new family most likely belongs to

Actions:

- added a small board-catalog helper that loads Stage 1 board, module, and MCU metadata and derives board summaries
- enriched family profiles with exact board details when discovery already knows the board id
- added scored candidate board matches so unresolved or future new-family profiles can point to likely existing board definitions
- updated the family-profile schema and device-manager README to document the richer profile structure

Validation:

- first `discover.ps1` rerun -> failed as expected on a literal escape-sequence artifact in the generated import line
- second `discover.ps1` rerun after the fix -> success; all four attached units still resolved as `known-unit`
- regenerated profile files now include exact board metadata and candidate board matches for the current Dial, CoreS3+GNSS, and P-NUCLEO families
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects


## 2026-03-29 15:14 Europe/London

Commands run:

- `Get-Content notes/codex/20-plan.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content notes/codex/40-context.md`

Actions:

- added a concrete Stage 2 backlog section to `notes/codex/30-tasks.md` covering the remaining discovery, history, profile, query, database, and service-layer tasks

## 2026-03-29 15:27 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/device-manager/data/inventory.json`
- `Get-Content project/device-manager/data/unit-history.json`
- `Get-Content project/scripts/discover-units.mjs`
- `Get-Content discover.ps1`
- added `project/device-manager/schema/unit-annotations.schema.json` and `project/device-manager/data/unit-annotations.json`
- added `project/scripts/set-unit-annotation.mjs` and top-level `annotate-unit.ps1`
- updated `project/scripts/discover-units.mjs`, `project/device-manager/schema/device-inventory.schema.json`, `project/device-manager/schema/unit-history.schema.json`, and `project/device-manager/README.md`
- `discover.ps1`

Actions:

- added a persistent annotation store keyed by stable unit id for labels, notes, owner, location, and purpose
- added a simple top-level annotation command so operators can label units without editing JSON by hand
- updated discovery so annotation data is merged into both the latest inventory snapshot and the cumulative unit history output

Validation:

- `discover.ps1` -> success; all four attached units still resolved as `known-unit` after the annotation model changes, with empty annotation objects merged by default

## 2026-03-29 15:52 Europe/London

Commands run:

- `git status --short --branch`
- `git diff -- project/scripts/discover-units.mjs`
- `git diff -- project/apps/m5stack_dial_demo/main/app_main.c`
- `git diff -- project/apps/m5stack_cores3_gnss_demo/main/app_main.c`
- `git diff -- project/apps/p_nucleo_usb001_demo/main/main.c`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`
- `build.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM3`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM5`
- `program.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit COM4`
- `discover.ps1`
- `validate.ps1`

Observed issues:

- the first retry of the flash step failed because the PowerShell executable path was wrapped incorrectly in the escalated command string and split at `C:\Program Files`; rerunning the already approved command in its simpler form fixed it
- `apply_patch` hit a Windows sandbox refresh failure during the documentation update step, so the notes were rewritten with narrow PowerShell file writes to avoid another broad edit failure

Actions:

- added a machine-readable firmware identity boot line to the ESP32 and STM32 demo apps
- updated discovery to parse and persist firmware app id, version, build id, and self-reported board id
- taught discovery matching to prefer firmware self-identification when available
- flashed the updated Dial firmware to `COM3` and `COM5`
- flashed the updated CoreS3 + GNSS firmware to `COM4`
- reran discovery and validation after the firmware updates
- updated Stage 2 notes, plan, task tracker, context, decisions, and release wrappers for the firmware-identity task

Validation:

- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success
- `build.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1` -> success
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM3` -> success; flashed Dial on MAC `c0:4e:30:13:2b:68`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM5` -> success; flashed Dial on MAC `c0:4e:30:12:b3:e0`
- `program.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit COM4` -> success; flashed CoreS3 + GNSS on MAC `48:27:e2:66:b0:04`
- `discover.ps1` -> success; persisted firmware identity for `COM3`, `COM4`, and `COM5`
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects
## 2026-03-29 16:12 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/scripts/set-unit-annotation.mjs`
- `Get-Content project/scripts/discover-units.mjs`
- `Get-Content project/device-manager/schema/unit-history.schema.json`
- `Get-Content project/device-manager/README.md`
- `discover.ps1`
- `validate.ps1`

Actions:

- extended the annotation update flow so ownership, location, and purpose are recorded into cumulative per-unit metadata history
- extended discovery so future scans preserve and grow metadata history in `unit-history.json`
- updated the unit-history schema and device-manager documentation for the metadata history layer
- documented the planned per-unit security model under `keys/README.md`
- added Stage 2 tasks for per-unit AES keys and asymmetric keypairs linked by stable unit identity

Validation:

- `discover.ps1` -> success; discovery still completed for the current four-unit bench after the metadata-history changes
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects

## 2026-03-29 16:26 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/scripts/discover-units.mjs`
- `Get-Content project/device-manager/data/unit-history.json`
- `discover.ps1`
- `validate.ps1`

Actions:

- extended discovery history so previously seen units remain in `unit-history.json` even when they are absent from the latest scan
- added per-unit missing-state fields: `present`, `lastPresentAt`, `lastMissingAt`, and `missingCount`
- added a controlled discovery ignore-port hook through `BOARD_MANAGER_DISCOVERY_IGNORE_PORTS` so missing-unit behavior can be validated without physically unplugging hardware
- updated the Stage 2 spec, plan, task tracker, context, and device-manager docs for missing-unit handling

Validation:

- `discover.ps1` -> success with all four attached units present
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects

## 2026-03-29 16:43 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/scripts/discover-units.mjs`
- `Get-Content project/device-manager/data/unit-history.json`
- `Get-Content project/device-manager/schema/unit-history.schema.json`
- `discover.ps1` with `BOARD_MANAGER_DISCOVERY_IGNORE_PORTS=COM6`
- `discover.ps1`
- `validate.ps1`

Observed issues:

- the first validation attempt mistakenly ran the simulated-missing scan and the normal scan in parallel, which left the persisted state reflecting the wrong pass
- a PowerShell string replacement inserted literal escape text into the schema and one source line; both were corrected before the final validation run
- ESP32 serial banner capture remains opportunistic; one intermediate normal scan matched the units but did not capture all firmware banners on every port

Actions:

- added unit transition summaries for first seen, last seen, last present, and last missing
- added family transition summaries plus `presentUnitCount` and `missingUnitCount`
- corrected the validation flow to run the simulated missing pass first and the real bench pass second
- updated Stage 2 notes, task tracker, context, decisions, and release wrappers for transition tracking

Validation:

- `discover.ps1` with `BOARD_MANAGER_DISCOVERY_IGNORE_PORTS=COM6` -> success; the Nucleo unit and family recorded a missing transition without being deleted from history
- `discover.ps1` -> success; restored the real four-unit bench state with transition data preserved
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects

## 2026-03-29 17:01 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/device-manager/data/inventory.json`
- `Get-Content project/device-manager/data/unit-history.json`
- `Get-Content project/scripts/common.ps1`
- `query.ps1 -View units`
- `query.ps1 -View families -Format json`
- `query.ps1 -View changes -Limit 6`
- `validate.ps1`

Actions:

- added `project/scripts/query-device-manager.mjs` as the first shared query layer over persisted units, families, and recent changes
- added `query.ps1` as the top-level local wrapper with self-managed environment setup
- made the query layer emit either text or stable JSON so the future web interface and remote callers can reuse the same contract
- updated the Stage 2 and Stage 4 notes to explicitly call out the shared query layer and future remote-call support

Validation:

- `query.ps1 -View units` -> success
- `query.ps1 -View families -Format json` -> success
- `query.ps1 -View changes -Limit 6` -> success
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects

## 2026-03-29 17:13 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/scripts/query-device-manager.mjs`
- `Get-Content query.ps1`
- `serve-device-manager.ps1 -Host 127.0.0.1 -Port 8787` via background process for validation
- `Invoke-RestMethod http://127.0.0.1:8787/health`
- `Invoke-RestMethod http://127.0.0.1:8787/api/query?view=units`
- `Invoke-RestMethod http://127.0.0.1:8787/api/query?view=families`
- `validate.ps1`

Actions:

- split the shared query logic into `device-manager-query-lib.mjs`
- kept `query.ps1` as the local CLI wrapper over the shared query contract
- added `project/scripts/device-manager-service.mjs` as the first HTTP service endpoint for local and remote consumers
- added `serve-device-manager.ps1` as the top-level service wrapper
- updated the spec and plan so the future web UI and remote systems both target the same JSON query service contract

Validation:

- local CLI queries still pass after the shared-library split
- HTTP `GET /health` -> success
- HTTP `GET /api/query?view=units` -> success
- HTTP `GET /api/query?view=families` -> success
- `validate.ps1` -> success; validated 22 parts, 5 boards, and 3 projects

## 2026-03-29 17:55 Europe/London
- Added compact discovery-run persistence at project/device-manager/data/discovery-runs.json and schema at project/device-manager/schema/discovery-runs.schema.json.
- Extended the shared query layer with view=diff for added or removed units, family population changes, and per-unit port or firmware changes between the latest two runs.
- Updated query.ps1 and the HTTP query service so the diff view is available to local operators, the future web UI, and remote callers.
- Validation: .\\discover.ps1, .\\validate.ps1, controlled discovery with BOARD_MANAGER_DISCOVERY_IGNORE_PORTS=COM6, restore discovery, node project/scripts/query-device-manager.mjs --view diff --format json, and .\\query.ps1 -View diff.
- Note: the initial diff validation intentionally used a controlled missing COM6 run; after the restore pass, the latest two normal scans returned an empty diff as expected.

- Validation: service check via node project/scripts/device-manager-service.mjs on 127.0.0.1:8788 with Invoke-WebRequest to /api/query?view=diff returned the expected JSON payload.

## 2026-03-29 18:00 Europe/London
- Added report export script project/scripts/export-device-manager-reports.mjs and top-level wrapper .\\export-reports.ps1.
- Exported reports to project/device-manager/reports/current-bench-report.json, project/device-manager/reports/unit-history-report.json, and project/device-manager/reports/report-manifest.json.
- Validation: .\\export-reports.ps1 plus direct inspection of the generated report files to confirm host, unit, family, diff, and history content were populated from the persisted Stage 2 data model.

## 2026-03-29 18:20 Europe/London
- Added normalized SQLite schema at project/device-manager/schema/device-manager.sqlite.sql and sync script at project/scripts/sync-device-manager-sqlite.py.
- Added top-level sync wrapper .\\sync-device-manager-db.ps1 and automatic SQLite sync hooks in .\\discover.ps1 and .\\annotate-unit.ps1.
- Persisted normalized SQLite database at project/device-manager/data/device-manager.sqlite from the current Stage 2 JSON sources.
- Validation: .\\discover.ps1, .\\sync-device-manager-db.ps1, and direct sqlite3 queries through Python confirmed 4 units, 3 families, 5 discovery runs, and current firmware/port rows for the attached bench units.

## 2026-03-29 18:32 Europe/London
- Added project/scripts/validate-device-manager-data.mjs to validate persisted Stage 2 data files and family profiles against their schemas.
- Hooked device-manager schema validation into validate.ps1 via common.ps1 so standard validation now checks both board definitions and persisted device-manager state.
- Validation: .\\validate.ps1 and direct run of node project/scripts/validate-device-manager-data.mjs both passed on the current repo state.
## 2026-03-29 18:48 Europe/London
- Added project/scripts/manage-unit-keys.py and top-level wrapper .\manage-unit-keys.ps1 for local root and per-unit key management.
- Added tracked schemas for local key manifests at project/device-manager/schema/unit-key-manifest.schema.json and project/device-manager/schema/key-manifest-index.schema.json.
- Generated a local root signing keypair plus per-unit AES and Ed25519 identity keys under keys/ for the four current stable units.
- Validation: .\manage-unit-keys.ps1 -AllUnits, .\manage-unit-keys.ps1 -Unit "mac:c0:4e:30:13:2b:68" -Rotate, and inspection of keys/key-manifest-index.json, keys/root/root-manifest.json, and unit manifest files. Note: generated secrets and local manifests remain gitignored and were not committed.

## 2026-03-29 19:05 Europe/London

Commands run:

- `Get-Content notes/codex/10-spec.md`
- `Get-Content notes/codex/30-tasks.md`
- `Get-Content project/scripts/discover-units.mjs`
- `Get-Content project/apps/m5stack_dial_demo/main/app_main.c`
- `Get-Content project/apps/m5stack_cores3_gnss_demo/main/app_main.c`
- `Get-Content project/apps/p_nucleo_usb001_demo/main/main.c`
- `Get-Content project/scripts/generate-board-artifacts.mjs`
- `node project/scripts/generate-board-artifacts.mjs`
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1`
- `build.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1`
- `build.ps1 -Platform stm32 -App p_nucleo_usb001_demo -Board p_nucleo_usb001_f072rb_v1`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM3`
- `program.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit COM4`
- `program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit COM5`
- `discover.ps1`
- `validate.ps1`
- `query.ps1 -View units -Format json`
- `sync-device-manager-db.ps1`
- `python -c "...sqlite query..."`

Observed issues:

- `apply_patch` continued to fail in the Windows sandbox before patch application, so this task used small file-by-file PowerShell edits instead.
- the first `p_nucleo_usb001_demo` host build failed at link time because `stm32f072rbtx_flash.ld` did not provide the `end` symbol expected by the bare-metal `_sbrk` path.
- discovery observed an extra `COM7` unit during validation, reported by Windows as `Silicon Labs CP210x USB to UART Bridge (COM7)`.

Actions:

- widened `board_descriptor_t` to carry generated capability lists and added `project/firmware-common/board_agent.h` as the shared board-agent handshake emitter.
- updated the artifact generator so each generated board descriptor now exports a deterministic sorted capability array from Stage 1 board metadata.
- updated the Dial, CoreS3+GNSS, and P-NUCLEO demo apps to emit a stable `BoardManagerAgent:` line alongside the existing `BoardManagerFirmware:` line.
- extended discovery to parse the board-agent handshake, merge its board/app/version/build identity into the existing firmware identity path, and persist `agentLine` plus capability sets in inventory, unit history, discovery runs, profiles, query output, and SQLite.
- extended candidate-board scoring to consider observed capability overlap when draft family profiles are ranked.
- widened the SQLite schema and sync flow to persist firmware capability sets and raw agent lines for units and discovery runs.
- fixed the F072 linker script by adding `_Min_Heap_Size`, `_Min_Stack_Size`, and `end` / `_end` symbols in the RAM heap-stack section.
- reran discovery after flashing the updated ESP32 units, which also created a new draft profile for the unexpected `COM7` CP210x bridge.

Validation:

- `node project/scripts/generate-board-artifacts.mjs` -> success; regenerated all five board sources with capability arrays in their descriptors.
- `build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1` -> success.
- `build.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1` -> success.
- first `build.ps1 -Platform stm32 -App p_nucleo_usb001_demo -Board p_nucleo_usb001_f072rb_v1` -> failed on undefined reference to `end`.
- second `build.ps1 -Platform stm32 -App p_nucleo_usb001_demo -Board p_nucleo_usb001_f072rb_v1` -> success after linker-script fix.
- `program.ps1 ... COM3` -> success; flashed updated Dial firmware and confirmed MAC `c0:4e:30:13:2b:68`.
- `program.ps1 ... COM4` -> success; flashed updated CoreS3+GNSS firmware and confirmed MAC `48:27:e2:66:b0:04`.
- `program.ps1 ... COM5` -> success; flashed updated Dial firmware and confirmed MAC `c0:4e:30:12:b3:e0`.
- `discover.ps1` -> success; persisted board-agent handshake data for COM3, COM4, and COM5, retained COM6, and created a draft profile for the unexpected COM7 CP210x bridge.
- `validate.ps1` -> success; validated 22 parts, 5 boards, 3 projects, 4 Stage 2 data files, and 4 profile files.
- `query.ps1 -View units -Format json` -> success; JSON output now includes `firmwareBoard` and `firmwareCapabilities`.
- `sync-device-manager-db.ps1` and direct SQLite query -> success; unit rows now include firmware capability strings and truncated board-agent lines.
