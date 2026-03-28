# Task Tracker

Last updated: 2026-03-28 20:22 Europe/London

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
- [ ] Validate programming flow against multiple connected units
- [x] Validate programming flow against a connected ESP32 unit on COM3
- [ ] Add reusable part-level init, smoke-test, and API contracts for shared devices such as `bm8563`, `ft3267`, `ws1850s`, and `gc9a01`
- [ ] Add per-part help/man pages with datasheet, website, and API usage references for the future web interface
