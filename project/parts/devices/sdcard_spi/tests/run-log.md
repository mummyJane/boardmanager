# SPI SD Card Test Run Log

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

- `test`: `read_card_info`
- `hardware`: `M5Stack CoreS3` SD slot
- `expected`: `The SPI-backed microSD test app should initialize the CoreS3 SD slot on GPIO4/GPIO35/GPIO36/GPIO37, mount the card, and print CID/CSD-style identification data.`
- `observed`: `Not run yet on hardware. The standalone ESP-IDF test app was created, but only the host-side code setup was completed in this pass.`
- `result`: `pending`
- `timeout`: `not run`
- `command`: `pending flash/run of project/parts/devices/sdcard_spi/tests/read_card_info`
- `notes`: `Run this after the hello-world module app is flashed cleanly through the current host workaround path.`
