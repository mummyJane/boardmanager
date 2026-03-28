# Parts Catalog

This folder contains reusable definitions shared across boards.

## Part Layers

- `mcu/`: MCU die or family definitions such as `esp32_s3`, `esp32`, and `stm32f446`
- `packages/`: packaged MCU variants such as `esp32_s3fn8`, `esp32_wroom_32_package`, and `stm32f446re_lqfp64`
- `modules/`: reusable modules such as `m5stamps3`, `esp32_wroom_32`, and `nucleo_f446re_controller`
- `devices/`: attached peripherals such as displays, RTCs, touch controllers, and RFID chips

Boards should reference these parts and provide only board-local assembly, wiring, boot order, and configuration.

MCU definitions also carry the platform SDK binding used by generation, for example `esp-idf` for ESP32 and `stm32cube` for STM32.
