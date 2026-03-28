#include "esp32_dev_relay_v1.h"

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
    "ESP32-WROOM-32",
    3,
    esp32_dev_relay_v1_io
};

void esp32_dev_relay_v1_init(void)
{
    /* TODO: configure MCU pins and peripherals for this board. */
}

void esp32_dev_relay_v1_status_led_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

void esp32_dev_relay_v1_relay_drive_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

bool esp32_dev_relay_v1_user_button_read(void)
{
    /* TODO: read the mapped MCU input. */
    return false;
}
