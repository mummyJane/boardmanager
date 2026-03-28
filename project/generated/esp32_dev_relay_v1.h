#ifndef ESP32_DEV_RELAY_V1_H
#define ESP32_DEV_RELAY_V1_H

#include "../firmware-common/board_api.h"

extern const board_descriptor_t esp32_dev_relay_v1_descriptor;

void esp32_dev_relay_v1_init(void);
void esp32_dev_relay_v1_status_led_set(bool enabled);
void esp32_dev_relay_v1_relay_drive_set(bool enabled);
bool esp32_dev_relay_v1_user_button_read(void);

#endif
