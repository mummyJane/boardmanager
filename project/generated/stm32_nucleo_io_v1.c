#include "stm32_nucleo_io_v1.h"

static const board_io_descriptor_t stm32_nucleo_io_v1_io[] = {
    { "heartbeat_led", BOARD_IO_DIGITAL_OUTPUT, "status_indicator", "PA5", "PA5", NULL, true },
    { "fan_enable", BOARD_IO_DIGITAL_OUTPUT, "power_enable", "PB4", "PB4", NULL, true },
    { "fault_input", BOARD_IO_DIGITAL_INPUT, "fault_detect", "PC13", "PC13", "EXTI13", false },
};

const board_descriptor_t stm32_nucleo_io_v1_descriptor = {
    "stm32_nucleo_io_v1",
    "STM32 Nucleo IO V1",
    "1.0",
    "STM32",
    "STM32F446RE",
    3,
    stm32_nucleo_io_v1_io
};

void stm32_nucleo_io_v1_init(void)
{
    /* TODO: configure MCU pins and peripherals for this board. */
}

void stm32_nucleo_io_v1_heartbeat_led_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

void stm32_nucleo_io_v1_fan_enable_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

bool stm32_nucleo_io_v1_fault_input_read(void)
{
    /* TODO: read the mapped MCU input. */
    return false;
}
