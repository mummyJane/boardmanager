# Projects

This folder contains project-level configurations that combine board definitions with firmware targets, deployment policy, and local overrides for reusable parts.

## Current Examples

- `m5stack_dial_demo.json`: ESP-IDF Dial smoke-test project with standard per-unit signed OTA enabled
- `m5stack_dial_secure_ota.json`: secure Dial deployment profile with per-unit signed and encrypted OTA payloads
- `m5stack_cores3_gnss_demo.json`: ESP-IDF CoreS3 + GNSS bench project metadata
- `p_nucleo_usb001_f072rb_demo.json`: STM32Cube P-NUCLEO-USB001 bench project metadata

A project can:

- select a board assembly
- define the concrete app root and reserved user-code area for that board target
- choose a firmware target family and entry point
- declare deployment transports such as USB or OTA
- declare OTA signing and encryption policy per project
- override per-device config for reused parts
- override per-signal defaults for board-local behavior

Reserved user-code rules:

- `app.userCodeRoot` is the area where board-specific user logic lives and should be edited
- framework entry files such as `app_main.c` or `main.c` are now thin handoff layers and should stay stable
- the stable user-facing API boundary is `firmware-common/board_user_api.h`
- per-project user code should expose `board_manager_user_app_start()` from files such as `board_app_user.c` and `board_app_user.h`

A board may have more than one project or app profile. Use the project metadata to tell apart bench demos, factory images, field builds, and secure OTA deployments that share the same board definition.
