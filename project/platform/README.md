# Platform Implementations

This folder contains concrete platform-side implementations that sit behind the generated board boot and signal hooks.

## Current Layout

- `esp-idf/`: ESP32-family implementations using Espressif APIs
- `stm32cube/`: STM32-family implementations using STM32 HAL/Cube APIs

## Current Coverage

- `m5stack_dial_v1_1_platform.c`: concrete ESP-IDF GPIO, I2C, and SPI boot path for the M5Stack Dial demo
- `m5stack_cores3_gnss_v1_platform.c`: concrete ESP-IDF GPIO, I2C, and UART boot path for the CoreS3 + GNSS bench assembly
- `esp32_dev_relay_v1_platform.c`: concrete ESP-IDF GPIO implementation for the relay sample board
- `stm32_nucleo_io_v1_platform.c`: STM32Cube HAL GPIO implementation for the STM32 sample board
- `p_nucleo_usb001_f072rb_v1_platform.c`: STM32Cube HAL GPIO scaffold for the attached P-NUCLEO-USB001 board

Generated board files remain thin wrappers. Concrete SDK code should continue to live here so regeneration does not overwrite platform work.
