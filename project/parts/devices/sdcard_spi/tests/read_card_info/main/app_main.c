#include <stdio.h>
#include <sys/stat.h>

#include "driver/spi_common.h"
#include "driver/sdspi_host.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"

#define SD_SPI_CS_PIN    GPIO_NUM_4
#define SD_SPI_SCK_PIN   GPIO_NUM_36
#define SD_SPI_MISO_PIN  GPIO_NUM_35
#define SD_SPI_MOSI_PIN  GPIO_NUM_37
#define SD_MOUNT_POINT   "/sdcard"

static const char *TAG = "sdcard_spi_card_info";

static void print_card_summary(const sdmmc_card_t *card)
{
    printf(
        "SDCardInfo: name=%s capacity_bytes=%llu sector_size=%u speed_khz=%d\n",
        card->cid.name,
        (unsigned long long)card->csd.capacity,
        card->csd.sector_size,
        card->max_freq_khz);
    printf(
        "SDCardCID: mid=%u oid=0x%04x pnm=%s prv=%u psn=%lu mdt=%u/%u\n",
        card->cid.mfg_id,
        card->cid.oem_id,
        card->cid.name,
        card->cid.revision,
        (unsigned long)card->cid.serial,
        card->cid.month,
        card->cid.year);
}

void app_main(void)
{
    esp_vfs_fat_sdmmc_mount_config_t mount_config = {
        .format_if_mount_failed = false,
        .max_files = 4,
        .allocation_unit_size = 16 * 1024,
        .disk_status_check_enable = false,
        .use_one_fat = false,
    };

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();
    host.max_freq_khz = SDMMC_FREQ_DEFAULT;

    spi_bus_config_t bus_cfg = {
        .mosi_io_num = SD_SPI_MOSI_PIN,
        .miso_io_num = SD_SPI_MISO_PIN,
        .sclk_io_num = SD_SPI_SCK_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 4000,
    };

    sdspi_device_config_t slot_config = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot_config.gpio_cs = SD_SPI_CS_PIN;
    slot_config.host_id = host.slot;

    sdmmc_card_t *card = NULL;

    ESP_LOGI(TAG, "Initializing SPI bus for CoreS3 SD slot");
    ESP_ERROR_CHECK(spi_bus_initialize(host.slot, &bus_cfg, SDSPI_DEFAULT_DMA));

    ESP_LOGI(TAG, "Mounting SD card filesystem");
    esp_err_t err = esp_vfs_fat_sdspi_mount(SD_MOUNT_POINT, &host, &slot_config, &mount_config, &card);
    if (err != ESP_OK) {
        printf("SDCardInfo: mount_failed err=%s\n", esp_err_to_name(err));
        spi_bus_free(host.slot);
        return;
    }

    print_card_summary(card);
    sdmmc_card_print_info(stdout, card);

    struct stat mount_stat = {0};
    if (stat(SD_MOUNT_POINT, &mount_stat) == 0) {
        printf("SDCardInfo: mount_point=%s status=ok mode=0x%x\n", SD_MOUNT_POINT, (unsigned)mount_stat.st_mode);
    } else {
        printf("SDCardInfo: mount_point=%s status=stat_failed\n", SD_MOUNT_POINT);
    }

    esp_vfs_fat_sdcard_unmount(SD_MOUNT_POINT, card);
    spi_bus_free(host.slot);
    printf("SDCardInfo: unmounted\n");
}
