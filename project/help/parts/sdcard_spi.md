# SPI microSD Card

This reusable part models an SPI-connected microSD card slot.

For the current CoreS3 test setup, the known working pin mapping from the official M5Stack CoreS3 documentation is:

- CS: `GPIO4`
- SCK: `GPIO36`
- MISO: `GPIO35`
- MOSI: `GPIO37`

Expected smoke-test meaning:

- the SPI bus initializes cleanly
- the card responds with readable identification fields
- the FAT filesystem mounts and basic file or directory access works

High-level API shape:

- `sdcard_mount`
- `sdcard_get_info`
- `sdcard_unmount`
