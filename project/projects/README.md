# Projects

This folder contains project-level configurations that combine board definitions with firmware targets, build settings, and local overrides for reusable parts.

## Current Examples

- `m5stack_dial_demo.json`: ESP-IDF Dial smoke-test project
- `m5stack_cores3_gnss_demo.json`: ESP-IDF CoreS3 + GNSS bench project metadata
- `p_nucleo_usb001_f072rb_demo.json`: STM32Cube P-NUCLEO-USB001 bench project metadata

A project can:

- select a board assembly
- choose a firmware target family
- override per-device config for reused parts
- override per-signal defaults for board-local behavior
