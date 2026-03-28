# Spec Updates

## 2026-03-28 14:30 Europe/London

- Added an explicit staged-delivery structure to the spec so board definitions, discovery, build/debug orchestration, and web UI can evolve in controlled milestones. This change is needed because the original project intent covered multiple major subsystems with different delivery horizons.

## 2026-03-28 14:52 Europe/London

- Expanded the stage-1 board-definition spec to explicitly cover grouped bus and connector metadata. This change is needed because the M5Stack Dial board includes internal I2C and SPI devices plus exposed expansion ports that should be modeled directly instead of being reduced to loose notes.

## 2026-03-28 15:03 Europe/London

- Expanded the stage-1 data model to separate reusable part definitions from board assemblies. This change is needed because multiple boards will reuse the same MCU families, packages, modules, and peripheral parts, while each board and project still needs local configuration and bindings.

## 2026-03-28 15:11 Europe/London

- Added a generated-code include-path rule forbidding parent-directory paths such as `..` in code files. This change is needed to match a build-system-managed include strategy and keep source layout independent from compiler include resolution.

## 2026-03-28 15:22 Europe/London

- Added explicit boot/setup sequencing and SDK binding to the stage-1 model. This change is needed because higher-level code can only assume a board is usable after controller, buses, devices, and board-level signals are initialized in a defined order, and that order depends on the chip SDK family (`esp-idf` or `stm32cube`).

## 2026-03-28 15:49 Europe/London

- Added a local-tooling requirement that SDKs, toolchains, downloads, and build outputs live under `project/`, with top-level scripts owning env setup and teardown. This change is needed so the workspace remains self-contained on Windows now and can be moved to a Raspberry Pi later with minimal assumptions about global host setup.

## 2026-03-28 16:10 Europe/London

- Added explicit validation requirements for part, board, and project definitions. This change is needed because the data model now has enough cross-references that generation, build, and flash should fail early on invalid wiring or override references instead of producing broken artifacts.

## 2026-03-28 16:16 Europe/London

- Completed the transition of sample boards to the reusable-part assembly schema. This change is needed to eliminate the mixed legacy/new board-definition paths and keep validation, generation, and future tooling focused on one consistent model.

## 2026-03-28 16:31 Europe/London

- Added an explicit generated-to-platform hook boundary for board boot and IO control. This change is needed because the project now has concrete `esp-idf` and `stm32cube` implementations, and those must survive regeneration while still matching the generated board API surface.

## 2026-03-28 19:45 Europe/London

- Added a host-side validation requirement for board builds without connected hardware. This change is needed because STM32 build verification should be possible from a Windows workstation even when no target board is physically attached.
- Clarified that the STM32 local build path may combine a local STM32Cube firmware package with a local Arm bare-metal compiler toolchain. This change is needed because the Windows STM32CubeCLT distribution is not ideal for unattended repo-owned installation, but the project still needs a reproducible local STM32 build path under project/.

## 2026-03-28 20:10 Europe/London

- Added a non-fatal smoke-test requirement for board demos and diagnostics. This change is needed because bring-up on real hardware should report which peripherals respond and which do not, instead of aborting the whole boot path on the first missing device.

## 2026-03-28 20:18 Europe/London

- Clarified that reusable parts, not boards, own init/setup contracts, smoke-test meaning, and reusable high-level API shape. This change is needed because shared devices such as m8563 should behave consistently across boards, with boards only supplying binding and local configuration.
- Added a requirement for per-part help/man pages suitable for the future web interface. This change is needed so each unit/part can expose its datasheet, website, and API usage documentation from a stable local source.

