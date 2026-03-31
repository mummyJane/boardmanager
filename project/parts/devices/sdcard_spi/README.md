# SPI microSD Card Tests

This folder owns module-level tests for the reusable `sdcard_spi` device part.

Current tests:

- `tests/read_card_info`: ESP-IDF app that initializes the CoreS3 SPI SD slot, mounts the card, and prints CID/CSD-style identification data
