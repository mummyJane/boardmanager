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
