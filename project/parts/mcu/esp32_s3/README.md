# ESP32-S3 Module Tests

This folder owns module-level tests for the reusable `esp32_s3` MCU part.

Current tests:

- `tests/hello_world`: minimal ESP-IDF app to prove build, flash, boot, and serial output
- `tests/read_fuse_data`: host-side timed eFuse summary read using `espefuse.py`

These tests are intentionally module-level and do not depend on a concrete board definition.
They are the first hardware checks to run before building board-level validation.
