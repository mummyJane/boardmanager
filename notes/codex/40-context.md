# Context

Last updated: 2026-03-29 09:24 Europe/London

## Project Intent

Board Manager is a new project intended to manage hardware boards based on ESP32 and STM32 MCUs. The first need is a clean source-of-truth representation of boards and IO. That metadata must drive generated firmware integration layers. Later the platform will discover boards over USB, store board inventory in a database, and manage build/program/debug workflows through a web interface.

## Repository State

- repository has an origin remote at `https://github.com/mummyJane/boardmanager.git`
- required `notes/codex` files are in place and being maintained
- sample board definitions exist for generic ESP32 and STM32 targets plus a concrete M5Stack Dial V1.1 profile
- reusable parts exist for MCU, package, module, and attached devices
- generated C headers and source stubs are produced under `project/generated`
- project-level config examples exist under `project/projects`
- generated board init emits ordered boot/setup stubs and records the platform SDK in the board descriptor
- local toolchain and SDK layout now exists under `project/`
- local ESP-IDF is installed under `project/toolchains/esp-idf/esp-idf`
- top-level build/clean/program/install scripts now manage environment setup internally
- a full Windows ESP32 build test passed for the `m5stack_dial_demo` app

## Initial Architecture Direction

- reusable part catalog in `project/parts`
- machine-readable board assemblies in `project/boards`
- project-specific overrides in `project/projects`
- generation script in `project/scripts`
- generated C artifacts in `project/generated`
- CMake-based firmware apps in `project/apps`
- local SDK and toolchain storage in `project/toolchains` and `project/tools`
- shared firmware-facing types and function contracts in `project/firmware-common`
- reserved folders for future web and device-manager services

## Concrete Board Knowledge Captured

- M5Stack Dial V1.1 modeled as an ESP32-S3 based board using the M5StampS3 module
- board profile includes key power, display, touch, RFID, encoder, I2C, SPI, expansion port mappings, and boot order
- reusable parts capture shared metadata for ESP32-S3, ESP32-S3FN8, M5StampS3, BM8563, WS1850S, FT3267, and GC9A01
- ESP32-family boards are currently mapped to `esp-idf`; STM32-family boards are currently mapped to `stm32cube`
- programming flow validated against a connected ESP32-S3 device on `COM3`; esptool identified it as an ESP32-S3 with embedded 8MB flash over USB-Serial/JTAG
- programming flow is now also validated with multiple connected units present by targeting only `COM5` while `COM3`, `COM4`, and `COM5` were all enumerated at once
- definition validation now checks reusable parts, board assemblies, boot-sequence references, bus/device signal links, and project-level overrides before build or flash
- the legacy flat sample boards have been converted to reusable-part board assemblies, so all current boards now flow through the same controller/package/module schema and boot-sequence generation path
- generated board APIs now delegate to concrete platform hook implementations instead of leaving boot and IO control in generated TODO stubs
- concrete platform implementations now exist under `project/platform/esp-idf` and `project/platform/stm32cube`
- the `m5stack_dial_demo` ESP32 app now compiles with the concrete M5Stack Dial ESP-IDF platform layer linked into the generated board component
- local STM32 tooling now uses an ST STM32CubeF4 firmware package checkout plus a project-local Arm GNU bare-metal toolchain under `project/toolchains`
- a host-side STM32 CMake build now passes for `stm32_nucleo_io_demo` without requiring connected hardware
- the current M5Stack Dial smoke-test app performs non-fatal presence checks for the RTC, touch controller, RFID device, display command path, buzzer, backlight, and live input signals
- the latest smoke-test run on the physical Dial over `COM3` reported `PASS` for controller GPIO, internal I2C setup, display SPI, and display command path, while RTC, touch, and RFID probes timed out on I2C and need follow-up
- a second physical Dial on `COM5` was fingerprinted as MAC `c0:4e:30:12:b3:e0`; before reflashing it reported a factory test image named `stamp_ring_factory_test` with I2C devices visible at `0x28`, `0x38`, and `0x51`
- a second ESP32-S3 unit on `COM4` was fingerprinted as MAC `48:27:e2:66:b0:04`; the user identifies it as an M5Stack CoreS3 with battery and GNSS module, but only ROM boot output has been captured so far from software
- after a targeted flash to `COM5`, the same port reported the Board Manager smoke-test live input stream, confirming the flash path can select one unit without disturbing the others
- the current attached bench inventory is `COM3` = M5Stack Dial, `COM4` = M5Stack CoreS3 with battery and GNSS, `COM5` = M5Stack Dial, and `COM6` = P-NUCLEO-USB001 based on Nucleo-F072RB
- part ownership has been clarified: reusable parts should own init/setup, smoke-test behavior, and high-level API shape, while boards only bind those parts into concrete hardware
- a per-part help/man page convention now exists under `project/help/parts`, with `bm8563` added as the first example including datasheet, website, and API usage guidance
