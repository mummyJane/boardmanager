# ESP32-S3 Test Run Log

Each run should record:

- `test`
- `hardware`
- `expected`
- `observed`
- `result`
- `timeout`
- `command`
- `notes`

## 2026-03-31 14:25 Europe/London

- `test`: `read_fuse_data`
- `hardware`: `M5Stack CoreS3` on `COM4`
- `expected`: `espefuse.py` connects to the ESP32-S3 and returns readable identity/config/security fuse data without changing the chip state.
- `observed`: `PASS`. `espefuse.py` connected and returned full summary data, including MAC `48:27:e2:66:b0:04`, package version `0`, wafer minor version `2`, optional unique 128-bit ID, flash/security/JTAG/USB fuse sections, and zeroed secure key blocks.
- `result`: `pass`
- `timeout`: `30s`
- `command`: `project/parts/mcu/esp32_s3/tests/read_fuse_data/run.ps1 -Port COM4 -TimeoutSeconds 30`
- `notes`: `This is the first proven module-level hardware read on the plain CoreS3 after the board reset.`

## 2026-03-31 14:25 Europe/London

- `test`: `hello_world` configure check
- `hardware`: `M5Stack CoreS3` host build only
- `expected`: `The standalone ESP-IDF hello-world app configures successfully for ESP32-S3 so it can later be built and flashed.`
- `observed`: `Mixed`. Direct `idf.py` failed on this Windows host with `PermissionError: [WinError 5] Access is denied`. A first direct `cmake` fallback also failed because the wrapper still had command/environment issues. After correcting the direct `cmake` invocation and disabling the ESP-IDF component manager, configure completed successfully and generated build files under `project/build/module-tests/esp32_s3/hello_world_no_manager`.
- `result`: `pass with host workaround`
- `timeout`: `180s`
- `command`: `cmake -G Ninja ... -S project/parts/mcu/esp32_s3/tests/hello_world -B project/build/module-tests/esp32_s3/hello_world_no_manager`
- `notes`: `For this host, prefer direct cmake/ninja over idf.py for standalone module tests.`

