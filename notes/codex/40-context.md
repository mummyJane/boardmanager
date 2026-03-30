## 2026-03-30

- Stage 3 now has build and program job orchestration complete and is moving onto run-job orchestration.
- Run jobs should capture serial console output from the resolved current port for a bounded duration and persist both human-readable logs and a machine-readable run report.

# Context

Last updated: 2026-03-29 23:20 Europe/London

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
- the current attached bench inventory is `COM3` = M5Stack Dial, `COM4` = M5Stack CoreS3 with battery and GNSS, `COM5` = M5Stack Dial, `COM6` = P-NUCLEO-USB001 based on Nucleo-F072RB, and `COM7` = an unresolved CP210x-backed ESP32/WROOM-32-class board
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


- unit history now keeps previously known units even when they are absent from the latest discovery run, using present, lastPresentAt, lastMissingAt, and missingCount fields
- discovery can ignore named COM ports via BOARD_MANAGER_DISCOVERY_IGNORE_PORTS for controlled missing-unit validation runs without changing bench wiring


- unit and family history now expose transition summaries through 	ransitions.firstSeen, 	ransitions.lastSeen, 	ransitions.lastPresent, and 	ransitions.lastMissing`r
- the current Nucleo unit and its family retain a valid lastMissing transition from the controlled COM6-ignored validation pass while ending the latest real discovery pass in the present state


- query.ps1 and project/scripts/query-device-manager.mjs now provide the first shared query layer over units, families, and recent changes
- the JSON query output is intended as the stable machine-facing form for both the later web UI and remote callers from another system


- serve-device-manager.ps1 and project/scripts/device-manager-service.mjs now expose the shared query contract over HTTP at /api/query and /health`r
- the same JSON query contract is now reachable from local or remote callers without going through PowerShell CLI output


- 2026-03-29 17:55 Europe/London: Stage 2 now persists compact discovery-run snapshots in project/device-manager/data/discovery-runs.json and exposes a latest-two-run diff through query.ps1 and the HTTP query service.

- 2026-03-29 18:00 Europe/London: Added export-reports.ps1 and project/scripts/export-device-manager-reports.mjs to emit stable JSON handoff files under project/device-manager/reports for the current bench snapshot and cumulative unit history.

- 2026-03-29 18:20 Europe/London: Added normalized SQLite persistence at project/device-manager/data/device-manager.sqlite with automatic sync from discover.ps1 and annotate-unit.ps1 via project/scripts/sync-device-manager-sqlite.py.

- 2026-03-29 18:32 Europe/London: Added project/scripts/validate-device-manager-data.mjs and hooked it into validate.ps1 so Stage 2 data files and family profiles are schema-checked alongside board definitions.

- 2026-03-29 18:48 Europe/London: Added local key-management tooling with a root signing keypair plus per-unit AES and Ed25519 identity keys under keys/. For now Board Manager generates these locally; later board setup may replace the unit identity keypair with a board-generated keypair.

- 2026-03-29 19:05 Europe/London: Generated board descriptors now expose capability lists through `board_descriptor_t`, and firmware-common now includes `board_agent.h` with a stable `BoardManagerAgent:` handshake emitter.
- 2026-03-29 19:05 Europe/London: The Dial and CoreS3 demo apps now emit both the older `BoardManagerFirmware:` line and the new `BoardManagerAgent:` line. The F072 demo also emits the board-agent line in its host-buildable path.
- 2026-03-29 19:05 Europe/London: Discovery now captures `agentLine` and `agentCapabilities`, merges board-agent identity into the existing firmware identity fields, stores capability sets in unit history, includes capability data in discovery-run summaries, and syncs the new data into SQLite.
- 2026-03-29 19:05 Europe/London: Query JSON for `query.ps1 -View units -Format json` now exposes `firmwareBoard` and `firmwareCapabilities` so later web and remote callers can consume the self-reported capability set without re-parsing raw history.
- 2026-03-29 19:05 Europe/London: Live validation after flashing updated firmware to `COM3`, `COM4`, and `COM5` captured these board-agent handshakes:
  - `COM3` Dial -> capabilities `display,rfid,rotaryEncoder,rtc,touch,usb,wifi`
  - `COM4` CoreS3 + GNSS -> capabilities `audio,battery,bluetooth_le,display,gnss,imu,jtag,rtc,touch,uart,usb,wifi`
  - `COM5` Dial -> capabilities `display,rfid,rotaryEncoder,rtc,touch,usb,wifi`
- 2026-03-29 19:05 Europe/London: The F072 linker script now includes heap/stack reservation plus `end` and `_end` symbols, which restored a clean host-side build for `p_nucleo_usb001_demo`.
- 2026-03-29 19:05 Europe/London: Discovery also observed an additional `COM7` unit during validation: `USB\\VID_10C4&PID_EA60\\0001`, presented by Windows as `Silicon Labs CP210x USB to UART Bridge (COM7)`. This created a draft family profile at `project/device-manager/profiles/unknown_10c4_ea60_silicon_labs_cp210x_usb_to_uart_bridge.json`.
- 2026-03-29 19:30 Europe/London: Stage 2 discovery now records registry-backed USB descriptor fields such as manufacturer, service, location information, and base USB identity for all currently attached serial devices.
- 2026-03-29 19:30 Europe/London: The attached P-NUCLEO / Nucleo-F072RB on COM6 is now matched from registry-backed STMicroelectronics USB identity evidence (`VID_0483`, `PID_374B`, `service=usbser`) rather than only the transport name.
- 2026-03-29 19:30 Europe/London: Discovery now probes CP210x-backed serial bridges as potential ESP targets. The COM7 unit was promoted from a generic USB-bridge record to `mac:c8:2e:18:f0:47:74` with chip `ESP32-D0WD-V3 (revision v3.1)`.
- 2026-03-29 19:30 Europe/London: Passive serial capture on COM7 at 115200 showed an ESP32 boot log, `ESP-IDF qa-test-v4.3.3-20220423` bootloader text, `module_name:WROOM-32`, and an OTA-style partition table with 4MB flash.
- 2026-03-29 19:30 Europe/London: Direct esptool probing on COM7 confirmed chip `ESP32-D0WD-V3 (revision v3.1)`, MAC `c8:2e:18:f0:47:74`, 40MHz crystal, WiFi+BT dual-core features, and detected 4MB flash.
- 2026-03-29 19:30 Europe/London: Discovery now maintains a new draft family profile at `project/device-manager/profiles/unknown_10c4_ea60_esp32.json` for the COM7 board, with Stage 1 candidate matching currently pointing weakly at the generic ESP32 sample family.
- 2026-03-29 19:30 Europe/London: The earlier generic CP210x profile remains in history as a superseded transport-only observation and highlights a remaining Stage 2 reconciliation task when identity quality improves from USB-instance-only to chip-MAC-based.
- 2026-03-29 19:45 Europe/London: Discovery now parses Windows USB location information into a small topology summary under each unit USB descriptor. Path-style locations become `path-segments`, while strings such as `Port_#0003.Hub_#0008` become `hub-port`.
- 2026-03-29 19:45 Europe/London: The current bench topology summaries are now visible through `query.ps1 -View units -Format json`, for example `COM3 -> 0014/005/001/000/000/000/000`, `COM4 -> 0014/005/003/000/000/000/000`, `COM5 -> 0014/005/002/000/000/000/000`, `COM6 -> 0014/005/004/002/000/000/000`, and `COM7 -> hub-8/port-3`.
- 2026-03-29 20:05 Europe/London: Discovery now promotes richer USB descriptor fields into persisted history and query output, including USB product name, hardware-id-derived revision, driver key, and the base USB serial token where available.
- 2026-03-29 20:05 Europe/London: Current bench examples now include `COM3/4/5` as `USB Serial Device (COMx)` revision `0101`, `COM6` as `STMicroelectronics STLink Virtual COM Port (COM6)` revision `0100`, and `COM7` as `Silicon Labs CP210x USB to UART Bridge (COM7)` revision `0100`.
- 2026-03-29 20:05 Europe/London: Query output for units now exposes `usbProductName`, `usbRevision`, `usbDriver`, `usbBaseSerialNumber`, and the existing topology path so later web or remote consumers can distinguish boards with more than VID/PID and COM port alone.

- 2026-03-29 19:50 Europe/London: Discovery now reconciles transport-only unit history into stronger identities when later scans recover better evidence such as a chip MAC. The COM7 ESP32 board now persists as `mac:c8:2e:18:f0:47:74` with `usb:USB\VID_10C4&PID_EA60\0001` preserved in `priorStableKeys` instead of as a second stale missing unit.

- 2026-03-29 20:08 Europe/London: Stage 2 discovery now preserves an explicit conflict ledger in `unit-history.json` when MAC, USB-instance, or serial evidence for one observation points at different prior units.
- 2026-03-29 20:08 Europe/London: The query layer and HTTP service now expose `view=conflicts`, and SQLite sync stores conflict rows for later operator tooling and UI work.
- 2026-03-29 20:08 Europe/London: Current live bench validation shows no active conflicts, while a synthetic mismatch validation through the exported conflict detector produced the expected competing-unit record without changing bench data.

- 2026-03-29 20:22 Europe/London: Added persistent manual unit overrides in `project/device-manager/data/unit-overrides.json`, managed through `override-unit.ps1` and merged into discovery/query output as operator-intent metadata.
- 2026-03-29 20:22 Europe/London: Manual override validation used a temporary board pin on `COM7` / `mac:c8:2e:18:f0:47:74`, confirmed that discovery and query output reflected the pin, then cleared it so the final bench state returned to the unresolved ESP32 family draft.
- 2026-03-29 20:45 Europe/London: Added `reconcile-family.ps1` and `project/scripts/reconcile-family-profile.mjs` so draft family profiles can be dry-run reviewed and later reconciled into known board profiles without losing the original draft evidence. Validation for this task stayed dry-run against `unknown_10c4_ea60_esp32` because the exact COM7 board identity is still not confirmed.

- 2026-03-29 21:05 Europe/London: Added `project/scripts/prune-device-manager-history.mjs` and `retain-history.ps1` to apply bounded retention to the Stage 2 model. Discovery now runs retention automatically after updating JSON state and before SQLite sync.

- 2026-03-29 21:20 Europe/London: The HTTP service now exposes direct JSON endpoints for `/api/inventory`, `/api/history`, and `/api/profiles` in addition to the earlier shared `/api/query` contract. Live validation confirmed filtered inventory lookup for COM7, filtered history lookup for the Dial family, and draft-profile listing for the unresolved CP210x-backed ESP32 board.

- 2026-03-29 21:40 Europe/London: Added `test.ps1` plus a dependency-free Node assertion runner under `project/tests/`. Current coverage now exercises board-candidate enrichment, identity-conflict detection, family-fingerprint derivation, missing-unit and family transition updates, and the direct service-data filters for inventory, history, and profiles.


## Current Planning Direction

- Milestone 2 is complete against the current tracked scope
- Milestone 3 is now being defined as validate, build, program, run, and debug orchestration rather than only flash and debug launch support
- the first Stage 3 workflow should start from a stable unit id from Stage 2 and the matched board profile from Stage 1
- the first validation flow should check controller identity first, then buses or IP blocks, then configured attached devices, and should report both expected and unexpected findings
- Stage 3 reports are expected to capture pass or fail outcomes plus identity and health data such as MAC, serial number, firmware id, firmware version, voltages, and temperatures where the board can expose them
- Stage 3 should define a protected user-code area and stable board API boundary so generated support code and user firmware can coexist cleanly
- 2026-03-29 22:25 Europe/London: Stage 3 now has an initial local persisted job store under project/job-manager, with jobs.json, a JSON schema, and a small CLI wrapper at job.ps1 for alidate, uild, program, 
un, and debug records.
- 2026-03-29 22:25 Europe/London: Standard validation now includes Stage 3 job-store validation through project/scripts/validate-job-manager-data.mjs.
- 2026-03-29 22:40 Europe/London: Stage 3 job creation now resolves requests against the current Stage 2 inventory. Unit-only requests inherit the matched board and family, board-plus-unit requests verify agreement, and board-only requests only resolve automatically when exactly one present unit currently matches the board.
- 2026-03-29 22:55 Europe/London: Stage 3 now generates board-specific validation contracts under `project/job-manager/contracts`. These plans are derived from `board.bootSequence`, bus wiring, signal metadata, and reusable part smoke-test contracts.
- 2026-03-29 23:05 Europe/London: Stage 3 now has a first validation runner at `validate-board.ps1` backed by `project/scripts/run-stage3-validation.mjs`. It parses `BoardManagerI2CScan:` serial lines and compares observed addresses against the generated validation contract.
- 2026-03-29 23:05 Europe/London: The Dial and CoreS3 demo apps now emit `BoardManagerI2CScan:` output, and the ESP-IDF platform layers expose board-local internal-I2C scan helpers for that purpose.
- 2026-03-29 23:20 Europe/London: Stage 3 validation reports now follow a structured schema with identity, summary, health, ordered phases, per-check evidence, and raw capture sections. Report validation is now part of `validate.ps1`.
- 2026-03-29 22:19 Europe/London: Reusable part definitions for m8563, t3267, ws1850s, and gc9a01 now include machine-readable alidationHooks, and generated Stage 3 contracts now prefer those hooks over free-text smoke-test checks for device-level validation phases.
- 2026-03-29 22:21 Europe/London: Corrected Stage 3 note formatting after adding reusable part validation hooks so the tracked context remains readable for later milestone work.
- 2026-03-29 22:36 Europe/London: Stage 3 validation now performs board-level orchestration in the host runner. The report merges current Stage 2 unit identity with live serial capture, records controller and firmware facts, carries signal samples such as Dial inputs and CoreS3 GNSS PPS state, and stores health arrays for voltages and temperatures when boards emit them.
- 2026-03-29 22:36 Europe/London: Live validation reports were regenerated for the attached Dial on COM3 and CoreS3 on COM4. Both currently fail their internal-I2C checks because the short capture windows only saw steady-state logs and no BoardManagerI2CScan: lines in those runs, but the new reports still preserve useful identity and signal evidence.
- 2026-03-29 22:48 Europe/London: COM7 remains unmatched to an exact Stage 1 board definition, but discovery and direct probing identify it as an ESP32-D0WD-V3 / WROOM-32-class board behind a Silicon Labs CP210x bridge with MAC c8:2e:18:f0:47:74 and 4MB flash.
- 2026-03-29 22:55 Europe/London: Ran a full bench sweep across the five attached cards. COM3, COM4, COM5, and COM6 each now have fresh Stage 3 validation reports under project/job-manager/reports/, while COM7 was refreshed through discovery-only identification because it still has no exact board-definition match.
- 2026-03-29 22:55 Europe/London: Current sweep status is fail for both Dial units, the CoreS3+GNSS unit, and the Nucleo board on their bus-scan checks; the unresolved COM7 board remains positively identified as an ESP32/WROOM-32-class card but unmatched to a board definition.

- 2026-03-30 00:25 Europe/London: Project metadata now supports more than one deployable app profile per board. The Dial board now has both a standard demo profile and a secure OTA profile, and Stage 3 job resolution preserves per-board candidate project ids when a board has multiple deployable profiles.
- 2026-03-30 00:25 Europe/London: OTA policy is now carried in project metadata: normal OTA projects require per-unit signing by the local root key, while secure projects additionally require per-unit AES encryption for OTA payloads.

- 2026-03-30 00:45 Europe/London: Firmware targets now split into a stable framework entrypoint and a reserved project-local user module. The shared handoff contract is `project/firmware-common/board_user_api.h`, and each current app now keeps user logic in `board_app_user.c` under its declared `userCodeRoot`.
- 2026-03-30 17:06 Europe/London: Stage 3 build jobs now run through build.ps1 into the persisted job store, with per-job logs under project/job-manager/logs and JSON reports under project/job-manager/reports.
- 2026-03-30 17:06 Europe/London: Build orchestration now records project resolution, board metadata, build type, selected build directory, log path, and result summary in the job and report model.
- 2026-03-30 17:06 Europe/London: build.ps1 now enforces explicit configure/build timeouts. A live STM32 validation run against p_nucleo_usb001_f072rb_demo timed out cleanly at cmake configure after 45 seconds, marked the job failed, wrote the log/report, and left no cmake or ninja process running.
- 2026-03-30 17:06 Europe/London: ESP-IDF build-job validation still fails on this Windows host with PermissionError: [WinError 5] Access is denied inside idf.py subprocess creation, but the failure is now captured as a normal failed build job with a full traceback in the per-job log instead of leaving inconsistent state.
- 2026-03-30 17:22 Europe/London: Stage 3 program jobs now run through program.ps1 into the persisted job store, with per-job logs under project/job-manager/logs and JSON reports under project/job-manager/reports.
- 2026-03-30 17:22 Europe/London: Program orchestration resolves the selected stable unit id to the current transport port before flashing. For the attached Dial unit mac:c0:4e:30:13:2b:68, the resolved transport was serial on COM3.
- 2026-03-30 17:22 Europe/London: A real ESP32 program-job validation on COM3 succeeded when rerun outside the sandbox. The earlier in-sandbox attempt failed with the same host-specific ESP-IDF subprocess permission issue seen in build jobs, but both outcomes were recorded cleanly through the Stage 3 job/report model.


- Debug jobs will emit launch metadata rather than holding an interactive debug session open from the orchestration script itself.


- Stage 3 now needs service endpoints on top of the local job store so the web UI can read job status, reports, logs, and artifact metadata without touching the filesystem directly.


- Milestone 3 now has local regression tests covering Stage 3 validation parsing and Stage 3 job-store service reads without requiring attached hardware.


- 2026-03-30 18:45 Europe/London: Milestone 4 is now defined around three operator areas in the web layer: module config, board config, and build/run.
- 2026-03-30 18:45 Europe/London: The Stage 4 model should stay tree-based. Modules may be leaf modules or composed modules, boards are assemblies of modules with local bindings, and projects target a selected board while combining user code, SDK code, third-party component code, and module code.
- 2026-03-30 18:45 Europe/London: Board creation must support both discovery-assisted first-guess creation from a newly seen unit and manual blank/template creation without prior discovery.
- 2026-03-30 18:45 Europe/London: The known-module catalog is expected to be seeded from operator-provided module inventories, starting with future M5Stack module lists from the user.

- 2026-03-30 19:00 Europe/London: The first user-provided Stage 4 catalog seed examples now include M5Stack entries such as CoreS3, Cardputer Adv Version, M5Stack Dial, RFID 2 Unit, 4-Relay Unit, GPS/BDS Unit v1.1, I/O Hub 1 to 6 Expansion Unit, 6-Axis IMU Unit, ADXL345 accelerometer unit, 8-Encoder Unit, RTC Unit, 8-Channel Servo Driver Unit, 8-Angle Unit, Byte Button Unit, Byte Switch Unit, M5GO Battery Bottom2, SERVO2 Module, Goplus2, 4IN8OUT, GNSS Module, Tough, and Crypto Authentication Unit.
- 2026-03-30 19:00 Europe/London: The first user-provided non-M5Stack board examples for catalog seeding are Waveshare ESP32-P4-WIFI6 and ESP32S3-Touch-LCD-7B.
- 2026-03-30 19:00 Europe/London: Stage 4 catalog work now needs to preserve the distinction between standalone boards and reusable modules, because some user-provided examples can appear in either role depending on assembly context.

- 2026-03-30 19:25 Europe/London: The user wants the Milestone 4 web server to be Python-based. Existing Node.js scripts may still generate and validate Stage 4 tree data, but the long-term HTTP host should move to Python.
- 2026-03-30 19:25 Europe/London: Stage 4 Task 1 is now represented by a generated tree artifact under project/web-ui, rooted in modules, boards, and projects, so the later Python service can serve a stable UI model instead of rebuilding tree views dynamically.

- 2026-03-30 20:05 Europe/London: Stage 4 now has a first Python-based read-only API host at serve-stage4-read-api.ps1 backed by project/scripts/stage4-read-api.py.
- 2026-03-30 20:05 Europe/London: The first Python endpoints expose /api/stage4/tree, /api/stage4/modules, /api/stage4/boards, /api/stage4/projects, and /api/stage4/help so the later web UI can browse both tree nodes and linked help content.

- 2026-03-30 20:30 Europe/London: Stage 4 now has a first served shell under project/web-ui/app, hosted by the Python Stage 4 service at / and /static/....
- 2026-03-30 20:30 Europe/London: The shell already loads module, board, and project lists from the Python Stage 4 read APIs, while inventory, jobs, and reports are present as reserved navigation targets for the next UI tasks.

- 2026-03-30 20:50 Europe/London: Stage 4 inventory is now backed by /api/stage4/dashboard/inventory, which merges current units, unresolved conflicts, override count, recent validation reports, and recent jobs from the existing Stage 2 and Stage 3 stores.
- 2026-03-30 20:50 Europe/London: The shell inventory panel now renders real present-unit cards instead of placeholder text, while the preview panel shows bench conflict and recent-validation summary information.

- 2026-03-30 21:20 Europe/London: The Python Stage 4 service now exposes /api/stage4/dashboard/modules as an aggregated module-catalog payload over the generated Stage 4 tree model, and the shell Modules view now renders vendor, role, help-reference, and composition coverage from that endpoint.

- 2026-03-30 21:45 Europe/London: The Python Stage 4 service now exposes /api/stage4/module-help/<moduleId> so the shell Modules view can show one selected module's references, high-level API, default config, and local help markdown without reconstructing that bundle in the browser.

- 2026-03-30 22:25 Europe/London: The Stage 4 Python service now supports a narrow POST /api/stage4/module-create flow for user-defined leaf device modules. It writes a new part definition under project/parts/devices, writes a local help page under project/help/parts, regenerates the tree model, and returns the created module detail payload to the shell.


- 2026-03-30 23:15 Europe/London: The Stage 4 Modules view now supports composed-module creation through the Python service, including child-module rows, module-level default config, and automatic regeneration of the Stage 4 tree model.
- 2026-03-30 23:15 Europe/London: Existing composed-module metadata is now normalized when older parts use composition fields such as `gnssReceiverPartId`, `imu`, `magnetometer`, and `barometer` instead of an explicit `composition.children` array. The current M5 Module GNSS entry now surfaces four child modules correctly in the tree and help payload.
- 2026-03-30 23:15 Europe/London: A direct in-process composed-module create/cleanup validation path hit `Access is denied` on this Windows host after the AV changes, so final task validation stayed on syntax checks, tree regeneration, help-payload inspection, and the standard repo validation flow.
- 2026-03-30 23:40 Europe/London: The Stage 4 Python service now exposes a guarded module update path through `PUT /api/stage4/modules/<moduleId>` plus a module edit payload at `/api/stage4/module-edit/<moduleId>`.
- 2026-03-30 23:40 Europe/London: Module updates are intentionally restricted to user-owned modules with `origin: user`; catalog-owned modules such as the seeded M5Stack entries return a forbidden response instead of being edited through the web write API.
