# Task Tracker

Last updated: 2026-03-29 16:43 Europe/London

- [x] Create required `notes/codex` source-of-truth documents
- [x] Create initial repository structure for project, install, update, and keys
- [x] Add sample board definitions for ESP32 and STM32
- [x] Add generator for firmware headers and API stubs
- [x] Add initial shared firmware API header
- [x] Add install/update scripts for Milestone 1
- [x] Initialize git repository and tag first milestone bootstrap
- [x] Add first concrete board profile for M5Stack Dial V1.1
- [x] Introduce reusable parts catalog for MCU, package, module, and attached devices
- [x] Refactor board schema to reference reusable parts with local board bindings
- [x] Add project-level override examples for firmware targets
- [x] Remove parent-directory include paths from generated code
- [x] Generate ordered board boot/setup stubs with platform SDK mapping
- [x] Add local toolchain/app/bootstrap layout under `project/`
- [x] Add top-level environment-managed `install-tools`, `build`, `clean`, and `program` scripts
- [x] Install local ESP-IDF under `project/` and complete an ESP32 build test
- [x] Add schema validation for board, part, and project definitions
- [x] Expand generic sample boards into reusable-part-based assemblies
- [x] Add concrete `esp-idf` and `stm32cube` implementations behind the generated boot stubs
- [x] Add automated STM32Cube local installation and a STM32 build test
- [x] Validate programming flow against multiple connected units
- [x] Validate programming flow against a connected ESP32 unit on COM3
- [x] Add reusable part-level init, smoke-test, and API contracts for shared devices such as `bm8563`, `ft3267`, `ws1850s`, and `gc9a01`
- [x] Add per-part help/man pages with datasheet, website, and API usage references for the future web interface
- [x] Add concrete board, project, generated-code, platform-stub, and help coverage for the attached CoreS3 + GNSS and P-NUCLEO-USB001 boards
- [x] Add a real ESP-IDF demo app and board-selectable build/program path for `m5stack_cores3_gnss_v1`
- [x] Build and flash the CoreS3 + GNSS demo on COM4 and capture serial bring-up output
- [x] Add local STM32CubeF0 support and a real STM32 demo app for `p_nucleo_usb001_f072rb_v1`
- [x] Complete a host-side F072 build validation for `p_nucleo_usb001_demo`
- [x] Milestone 1 complete
- [x] Add a persisted device-inventory schema and local inventory store for discovery
- [x] Add a Windows discovery script and top-level wrapper for the current bench
- [x] Capture and persist the first matched discovery snapshot for COM3-COM6
- [x] Persist stable per-unit identity fields so identical boards such as the two Dial units remain distinguishable across discovery runs
- [x] Add a cumulative unit-history layer for discovery runs
- [x] Match new physical units against previously seen board families before treating them as brand-new cards
- [x] Start draft family profiles for newly observed card families
- [x] Enrich family profiles with Stage 1 board metadata and likely board candidates

## Stage 2 Next Tasks

- [x] Add operator-assigned labels and notes per physical unit
- [x] Track firmware version/build identity per unit across discovery runs
- [x] Track board ownership, location, and purpose metadata in the history layer
- [x] Record unplugged or missing units without losing their history record
- [x] Add first-seen, last-seen, and last-missing transitions to the persisted family and unit model
- [ ] Add a simple query CLI for listing units, families, and recent discovery changes
- [ ] Add a diff view between the latest two discovery runs
- [ ] Add exportable JSON reports for the current bench inventory and unit history
- [ ] Normalize the history store into a simple SQLite database behind the same discovery model
- [ ] Add schema validation for the new history and profile data files
- [ ] Add per-unit key manifests linking each stable unit id to an AES key record and an asymmetric keypair record
- [ ] Add key-generation and rotation tooling under keys/ for per-unit AES keys and asymmetric keypairs
- [ ] Add a board-agent handshake path so firmware can self-identify board id, firmware version, and capabilities directly
- [ ] Add stronger STM32-family fingerprinting beyond ST-LINK transport naming
- [ ] Add USB hub or topology metadata when it can be observed reliably
- [ ] Add serial-number and descriptor probing for devices that expose richer USB identity
- [ ] Add conflict handling when observed identity evidence disagrees with prior history
- [ ] Add manual override support when an operator wants to pin a unit to a board or family
- [ ] Add merge/reconcile tooling for draft family profiles after a board type is understood
- [ ] Add retention rules for historical observations so the local database stays manageable
- [ ] Add basic service-layer APIs for querying inventory, history, and profiles
- [ ] Add tests for discovery matching, history updates, and profile enrichment logic





