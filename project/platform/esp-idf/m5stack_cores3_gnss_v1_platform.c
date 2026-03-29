#include "m5stack_cores3_gnss_v1.h"`r`n#include "m5stack_cores3_gnss_v1_platform.h"

#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "driver/uart.h"
#include "esp_check.h"
#include "esp_log.h"

#define CORES3_I2C_PORT I2C_NUM_0
#define CORES3_GNSS_UART UART_NUM_1
#define CORES3_I2C_SPEED_HZ 400000

static const char *TAG = "cores3_gnss";
static i2c_master_bus_handle_t s_i2c_bus;
static bool s_rtc_present;
static bool s_pmu_present;
static bool s_gnss_uart_ready;

static bool probe_i2c_device(uint16_t address, const char *label)
{
    if (s_i2c_bus == NULL) {
        ESP_LOGW(TAG, "%s probe skipped because I2C is not ready", label);
        return false;
    }

    const esp_err_t err = i2c_master_probe(s_i2c_bus, address, 50);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "%s responded on I2C address 0x%02X", label, address);
        return true;
    }

    ESP_LOGW(TAG, "%s probe failed on I2C address 0x%02X: %s", label, address, esp_err_to_name(err));
    return false;
}

void m5stack_cores3_gnss_v1_platform_boot_controller(void)
{
    const gpio_config_t input_config = {
        .pin_bit_mask = 1ULL << GPIO_NUM_8,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&input_config));
}

void m5stack_cores3_gnss_v1_platform_boot_internal_i2c(void)
{
    if (s_i2c_bus != NULL) {
        return;
    }

    const i2c_master_bus_config_t bus_config = {
        .i2c_port = CORES3_I2C_PORT,
        .sda_io_num = GPIO_NUM_12,
        .scl_io_num = GPIO_NUM_11,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .intr_priority = 0,
        .trans_queue_depth = 4,
        .flags.enable_internal_pullup = 1,
        .flags.allow_pd = 0,
    };

    ESP_ERROR_CHECK(i2c_new_master_bus(&bus_config, &s_i2c_bus));
}

void m5stack_cores3_gnss_v1_platform_boot_rtc(void)
{
    s_rtc_present = probe_i2c_device(0x51, "RTC");
}

void m5stack_cores3_gnss_v1_platform_boot_pmu(void)
{
    s_pmu_present = probe_i2c_device(0x34, "PMU");
}

void m5stack_cores3_gnss_v1_platform_boot_gnss_uart(void)
{
    const uart_config_t config = {
        .baud_rate = 38400,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .rx_flow_ctrl_thresh = 0,
        .source_clk = UART_SCLK_DEFAULT,
    };

    ESP_ERROR_CHECK(uart_driver_install(CORES3_GNSS_UART, 2048, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(CORES3_GNSS_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(CORES3_GNSS_UART, GPIO_NUM_17, GPIO_NUM_18, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
    s_gnss_uart_ready = true;
}

void m5stack_cores3_gnss_v1_platform_boot_gnss_module(void)
{
    if (!s_gnss_uart_ready) {
        ESP_LOGW(TAG, "GNSS module init skipped because UART is not ready");
        return;
    }

    ESP_LOGI(TAG, "GNSS module UART path ready");
}


size_t m5stack_cores3_gnss_v1_platform_scan_internal_i2c(uint8_t *addresses, size_t max_count)
{
    static const uint16_t candidates[] = { 0x34, 0x51 };
    size_t count = 0;

    if (addresses == NULL || max_count == 0 || s_i2c_bus == NULL) {
        return 0;
    }

    for (size_t index = 0; index < (sizeof(candidates) / sizeof(candidates[0])); index += 1) {
        if (i2c_master_probe(s_i2c_bus, candidates[index], 50) == ESP_OK) {
            if (count < max_count) {
                addresses[count] = (uint8_t)candidates[index];
            }
            count += 1;
        }
    }

    return count;
}
bool m5stack_cores3_gnss_v1_platform_gnss_pps_read(void)
{
    return gpio_get_level(GPIO_NUM_8) != 0;
}

