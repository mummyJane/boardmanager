# Parts Catalog

This folder contains reusable definitions shared across boards.

## Part Layers

- `mcu/`: MCU die or family definitions such as `esp32_s3`
- `packages/`: packaged MCU variants such as `esp32_s3fn8`
- `modules/`: reusable modules such as `m5stamps3`
- `devices/`: attached peripherals such as displays, RTCs, touch controllers, and RFID chips

Boards should reference these parts and provide only board-local assembly, wiring, and configuration.
