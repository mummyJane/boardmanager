#include "esp32_dev_relay_v1.h"
#include <stddef.h>

void esp32_dev_relay_v1_platform_boot_controller(void);
void esp32_dev_relay_v1_platform_status_led_set(bool enabled);
void esp32_dev_relay_v1_platform_relay_drive_set(bool enabled);
bool esp32_dev_relay_v1_platform_user_button_read(void);

static void esp32_dev_relay_v1_boot_controller(void)
{
    esp32_dev_relay_v1_platform_boot_controller();
}

static const board_io_descriptor_t esp32_dev_relay_v1_io[] = {
    { "status_led", BOARD_IO_DIGITAL_OUTPUT, "status_indicator", "GPIO2", "IO2", NULL, true },
    { "relay_drive", BOARD_IO_DIGITAL_OUTPUT, "relay_control", "GPIO16", "IO16", NULL, true },
    { "user_button", BOARD_IO_DIGITAL_INPUT, "manual_trigger", "GPIO0", "IO0", NULL, false },
};

const board_descriptor_t esp32_dev_relay_v1_descriptor = {
    "esp32_dev_relay_v1",
    "ESP32 Dev Relay V1",
    "1.0",
    "ESP32",
    "ESP32-WROOM-32 Package",
    "esp-idf",
    3,
    esp32_dev_relay_v1_io
};

void esp32_dev_relay_v1_init(void)
{
    /* Boot sequence generated for esp-idf. */
    esp32_dev_relay_v1_boot_controller();
    esp32_dev_relay_v1_status_led_set(false);
    esp32_dev_relay_v1_relay_drive_set(false);
}

void esp32_dev_relay_v1_status_led_set(bool enabled)
{
    esp32_dev_relay_v1_platform_status_led_set(enabled);
}

void esp32_dev_relay_v1_relay_drive_set(bool enabled)
{
    esp32_dev_relay_v1_platform_relay_drive_set(enabled);
}

bool esp32_dev_relay_v1_user_button_read(void)
{
    return esp32_dev_relay_v1_platform_user_button_read();
}
