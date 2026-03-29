# Context

Last updated: 2026-03-29 16:12 Europe/London

## Project Intent

Board Manager is a new project intended to manage hardware boards based on ESP32 and STM32 MCUs. The first need is a clean source-of-truth representation of boards and IO. That metadata must drive generated firmware integration layers. Later the platform will discover boards over USB, store board inventory in a database, and manage build/program/debug workflows through a web interface.

## Repository State

- repository has an origin remote at `https://github.com/mummyJane/boardmanager.git`
- required `notes/codex` files are in place and being maintained
- reusable parts now cover current ESP32 and STM32 bench hardware plus shared devices such as RTC, PMU, touch, RFID, display, GNSS, and USB PD control parts
- board definitions now exist for the two attached M5Stack Dial units, the attached CoreS3 with GNSS module assembly, the attached P-NUCLEO-USB001 / Nucleo-F072RB unit, and retained generic sample boards
- generated C headers and source stubs are produced under `project/generated`
- project-level config examples exist under `project/projects`
- generated board init emits ordered boot/setup stubs and records the platform SDK in the board descriptor
- local toolchain and SDK layout now exists under `project/`, including local STM32CubeF4 and STM32CubeF0 firmware package checkouts
- top-level build/clean/program/install scripts now manage environment setup internally
- Milestone 1 is now complete

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
- local help/man pages for parts and boards under `project/help`

## Concrete Board Knowledge Captured

- M5Stack Dial V1.1 is modeled as an ESP32-S3 based board using the M5StampS3 module
- M5Stack CoreS3 + GNSS is modeled as a concrete board assembly using the CoreS3 controller plus an attached GNSS module on the host expansion bus
- P-NUCLEO-USB001 is modeled as a concrete board assembly using the Nucleo-F072RB controller plus a USB PD management path
- reusable parts capture shared metadata for ESP32-S3, ESP32-S3FN8, ESP32-S3FN16, M5StampS3, CoreS3 controller, BM8563, AXP2101, FT3267, WS1850S, GC9A01, NEO-M9N, M5 Module GNSS, STM32F072, Nucleo-F072RB controller, and STUSB4761
- reusable device parts now include explicit init contracts, smoke-test contracts, high-level API shape, and local help/man page references
- ESP32-family boards are currently mapped to `esp-idf`; STM32-family boards are currently mapped to `stm32cube`
- programming flow validated against a connected ESP32-S3 device on `COM3`; esptool identified it as an ESP32-S3 with embedded 8MB flash over USB-Serial/JTAG
- programming flow is also validated with multiple connected units present by targeting only `COM5` while `COM3`, `COM4`, and `COM5` were all enumerated at once
- definition validation now checks reusable parts, board assemblies, boot-sequence references, bus/device signal links, and project-level overrides before build or flash
- the legacy flat sample boards have been converted to reusable-part board assemblies, so all current boards now flow through the same controller/package/module schema and boot-sequence generation path
- generated board APIs now delegate to concrete platform hook implementations instead of leaving boot and IO control in generated TODO stubs
- concrete platform implementations now exist under `project/platform/esp-idf` and `project/platform/stm32cube`
- the `m5stack_dial_demo` ESP32 app compiles with the concrete M5Stack Dial ESP-IDF platform layer linked into the generated board component
- the `m5stack_cores3_gnss_demo` ESP32 app now compiles and was flashed successfully to `COM4`
- serial output on `COM4` confirms the CoreS3 demo is running and repeatedly reporting `Live GNSS PPS state: 0`
- local STM32 tooling now uses ST STM32CubeF4 and STM32CubeF0 firmware package checkouts plus a project-local Arm GNU bare-metal toolchain under `project/toolchains`
- host-side STM32 CMake builds now pass for both `stm32_nucleo_io_demo` and `p_nucleo_usb001_demo`
- the current M5Stack Dial smoke-test app performs non-fatal presence checks for the RTC, touch controller, RFID device, display command path, buzzer, backlight, and live input signals
- the latest smoke-test run on the physical Dial over `COM3` reported `PASS` for controller GPIO, internal I2C setup, display SPI, and display command path, while RTC, touch, and RFID probes timed out on I2C and need follow-up
- a second physical Dial on `COM5` was fingerprinted as MAC `c0:4e:30:12:b3:e0`; before reflashing it reported a factory test image named `stamp_ring_factory_test` with I2C devices visible at `0x28`, `0x38`, and `0x51`
- a second ESP32-S3 unit on `COM4` was fingerprinted as MAC `48:27:e2:66:b0:04`; the user identifies it as an M5Stack CoreS3 with battery and GNSS module
- after a targeted flash to `COM5`, the same port reported the Board Manager smoke-test live input stream, confirming the flash path can select one unit without disturbing the others
- the current attached bench inventory is `COM3` = M5Stack Dial, `COM4` = M5Stack CoreS3 with battery and GNSS, `COM5` = M5Stack Dial, and `COM6` = P-NUCLEO-USB001 based on Nucleo-F072RB
- per-part help/man pages now exist for the shared Dial parts plus newly added PMU, GNSS, and USB PD parts, and board help pages exist for the current real boards
- the current schema still treats stacked accessory modules as concrete board assemblies rather than true nested subassemblies; this is now explicitly documented as an accepted interim model

## Discovery Baseline

- a first local discovery slice now exists under `project/device-manager`
- the persisted inventory schema is stored at `project/device-manager/schema/device-inventory.schema.json`
- the latest snapshot is stored at `project/device-manager/data/inventory.json`
- the Windows discovery script is `project/scripts/discover-units.mjs` with a top-level wrapper at `discover.ps1`
- the latest discovery run matched all four attached units: `COM3` and `COM5` as `m5stack_dial_v1_1`, `COM4` as `m5stack_cores3_gnss_v1`, and `COM6` as `p_nucleo_usb001_f072rb_v1`
- the persisted inventory now stores stable per-unit identity records with MAC-based keys for the two attached Dial units, allowing them to be distinguished independently from their current COM port assignments
- the current matching logic uses port data, USB identifiers, STLink naming, and short firmware signature lines as the first heuristic set
- discovery now persists cumulative unit history in `project/device-manager/data/unit-history.json` and family profile stubs under `project/device-manager/profiles`
- the first history-populating discovery pass classified COM3, COM4, and COM6 as `new-family` and COM5 as `known-family` because the Dial family had already been seen earlier in the same run
- the second discovery pass classified all four currently attached units as `known-unit` using stable identity keys from history
- the history layer now records first seen, last seen, seen count, family key, aliases, and accumulated observed signatures per physical unit
- family profiles are now enriched from the Stage 1 board catalog with exact board metadata for known families and scored candidate boards for unresolved families
- the current Dial, CoreS3+GNSS, and P-NUCLEO profile files now include vendor, revision, product SKU, chip family, SDK, capabilities, source links, and ranked candidate board matches
- operator annotations are now stored in `project/device-manager/data/unit-annotations.json` and merged into both `inventory.json` and `unit-history.json` on each discovery run
- the top-level `annotate-unit.ps1` script now lets the operator assign a stable label, notes, owner, location, and purpose to a physical unit by stable key instead of by COM port
- discovery now persists firmware identity fields per unit where the firmware exposes them, including firmware app id, version, build id, and self-reported board id
- the latest live discovery run captured firmware identities for the attached ESP32 units:
  - `COM3` / `mac:c0:4e:30:13:2b:68` -> `m5stack_dial_demo` version `0.1.0-dev` for `m5stack_dial_v1_1`
  - `COM4` / `mac:48:27:e2:66:b0:04` -> `m5stack_cores3_gnss_demo` version `0.1.0-dev` for `m5stack_cores3_gnss_v1`
  - `COM5` / `mac:c0:4e:30:12:b3:e0` -> `m5stack_dial_demo` version `0.1.0-dev` for `m5stack_dial_v1_1`
  - `COM6` still has no firmware self-report path through the current STLink VCP probe
- unit history now preserves cumulative owner/location/purpose metadata history in addition to the latest annotation snapshot
- keys/README.md now records the planned per-unit security model: one AES key and one asymmetric keypair per physical unit, linked by stable unit id

