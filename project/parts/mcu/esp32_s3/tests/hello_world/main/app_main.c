#include <stdio.h>

#include "esp_app_desc.h"
#include "esp_chip_info.h"
#include "esp_flash.h"
#include "esp_mac.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static void print_chip_summary(void)
{
    esp_chip_info_t chip_info = {0};
    uint8_t mac[6] = {0};
    uint32_t flash_size = 0;

    esp_chip_info(&chip_info);
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    esp_flash_get_size(NULL, &flash_size);

    printf("ESP32-S3 hello world test starting\n");
    printf(
        "Hello from ESP32-S3: cores=%d revision=%d features=0x%x flash=%uMB mac=%02x:%02x:%02x:%02x:%02x:%02x\n",
        chip_info.cores,
        chip_info.revision,
        chip_info.features,
        (unsigned)(flash_size / (1024 * 1024)),
        mac[0],
        mac[1],
        mac[2],
        mac[3],
        mac[4],
        mac[5]);
    printf(
        "Firmware: project=%s version=%s build_time=%s %s\n",
        esp_app_get_description()->project_name,
        esp_app_get_description()->version,
        __DATE__,
        __TIME__);
}

void app_main(void)
{
    print_chip_summary();

    while (1) {
        printf("ESP32-S3 hello heartbeat uptime_ms=%lld\n", esp_timer_get_time() / 1000);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
