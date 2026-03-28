#ifndef STM32_NUCLEO_IO_V1_H
#define STM32_NUCLEO_IO_V1_H

#include "../firmware-common/board_api.h"

extern const board_descriptor_t stm32_nucleo_io_v1_descriptor;

void stm32_nucleo_io_v1_init(void);
void stm32_nucleo_io_v1_heartbeat_led_set(bool enabled);
void stm32_nucleo_io_v1_fan_enable_set(bool enabled);
bool stm32_nucleo_io_v1_fault_input_read(void);

#endif
