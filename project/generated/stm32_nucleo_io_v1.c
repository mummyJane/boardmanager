#include "stm32_nucleo_io_v1.h"
#include <stddef.h>

void stm32_nucleo_io_v1_platform_boot_controller(void);
void stm32_nucleo_io_v1_platform_heartbeat_led_set(bool enabled);
void stm32_nucleo_io_v1_platform_fan_enable_set(bool enabled);
bool stm32_nucleo_io_v1_platform_fault_input_read(void);

static void stm32_nucleo_io_v1_boot_controller(void)
{
    stm32_nucleo_io_v1_platform_boot_controller();
}

static const board_io_descriptor_t stm32_nucleo_io_v1_io[] = {
    { "heartbeat_led", BOARD_IO_DIGITAL_OUTPUT, "status_indicator", "PA5", "PA5", NULL, true },
    { "fan_enable", BOARD_IO_DIGITAL_OUTPUT, "power_enable", "PB4", "PB4", NULL, true },
    { "fault_input", BOARD_IO_DIGITAL_INPUT, "fault_detect", "PC13", "PC13", "EXTI13", false },
};

const board_descriptor_t stm32_nucleo_io_v1_descriptor = {
    "stm32_nucleo_io_v1",
    "STM32 Nucleo IO V1",
    "1.0",
    "STM32F446",
    "STM32F446RE LQFP64",
    "stm32cube",
    3,
    stm32_nucleo_io_v1_io
};

void stm32_nucleo_io_v1_init(void)
{
    /* Boot sequence generated for stm32cube. */
    stm32_nucleo_io_v1_boot_controller();
    stm32_nucleo_io_v1_heartbeat_led_set(false);
    stm32_nucleo_io_v1_fan_enable_set(false);
}

void stm32_nucleo_io_v1_heartbeat_led_set(bool enabled)
{
    stm32_nucleo_io_v1_platform_heartbeat_led_set(enabled);
}

void stm32_nucleo_io_v1_fan_enable_set(bool enabled)
{
    stm32_nucleo_io_v1_platform_fan_enable_set(enabled);
}

bool stm32_nucleo_io_v1_fault_input_read(void)
{
    return stm32_nucleo_io_v1_platform_fault_input_read();
}
