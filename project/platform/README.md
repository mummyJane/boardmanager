# Platform Implementations

This folder contains concrete platform-side implementations that sit behind the generated board boot and signal hooks.

## Current Layout

- `esp-idf/`: ESP32-family implementations using Espressif APIs
- `stm32cube/`: STM32-family implementations using STM32 HAL/Cube APIs

Current coverage:

- `m5stack_dial_v1_1_platform.c`: concrete ESP-IDF GPIO/I2C/SPI boot path for the M5Stack Dial demo
- `esp32_dev_relay_v1_platform.c`: concrete ESP-IDF GPIO implementation for the relay sample board
- `stm32_nucleo_io_v1_platform.c`: STM32Cube HAL GPIO implementation for the STM32 sample board
