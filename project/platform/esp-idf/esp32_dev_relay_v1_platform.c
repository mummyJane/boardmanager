#include "esp32_dev_relay_v1.h"

#include "driver/gpio.h"
#include "esp_check.h"

void esp32_dev_relay_v1_platform_boot_controller(void)
{
    const gpio_config_t output_config = {
        .pin_bit_mask = (1ULL << GPIO_NUM_2) | (1ULL << GPIO_NUM_16),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&output_config));

    const gpio_config_t input_config = {
        .pin_bit_mask = 1ULL << GPIO_NUM_0,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&input_config));
}

void esp32_dev_relay_v1_platform_status_led_set(bool enabled)
{
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_2, enabled ? 1 : 0));
}

void esp32_dev_relay_v1_platform_relay_drive_set(bool enabled)
{
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_16, enabled ? 1 : 0));
}

bool esp32_dev_relay_v1_platform_user_button_read(void)
{
    return gpio_get_level(GPIO_NUM_0) == 0;
}
