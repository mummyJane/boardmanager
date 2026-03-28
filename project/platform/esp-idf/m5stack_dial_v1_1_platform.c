#include "m5stack_dial_v1_1.h"

#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "driver/spi_common.h"
#include "driver/spi_master.h"
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define M5DIAL_I2C_PORT I2C_NUM_0
#define M5DIAL_SPI_HOST SPI2_HOST
#define M5DIAL_I2C_SPEED_HZ 400000
#define M5DIAL_SPI_SPEED_HZ SPI_MASTER_FREQ_40M

static const char *TAG = "m5dial_platform";
static i2c_master_bus_handle_t s_internal_i2c_bus;
static i2c_master_dev_handle_t s_rtc_handle;
static i2c_master_dev_handle_t s_rfid_handle;
static i2c_master_dev_handle_t s_touch_handle;
static spi_device_handle_t s_display_handle;
static bool s_spi_ready;

void m5stack_dial_v1_1_platform_rfid_reset_set(bool enabled);


static void configure_output_gpio(gpio_num_t pin)
{
    const gpio_config_t config = {
        .pin_bit_mask = 1ULL << pin,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&config));
}

static void configure_input_gpio(gpio_num_t pin, bool pullup)
{
    const gpio_config_t config = {
        .pin_bit_mask = 1ULL << pin,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = pullup ? GPIO_PULLUP_ENABLE : GPIO_PULLUP_DISABLE,
        .pull_down_en = pullup ? GPIO_PULLDOWN_DISABLE : GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&config));
}

static void send_display_command(uint8_t command)
{
    spi_transaction_t transaction = {
        .length = 8,
        .tx_buffer = &command,
    };

    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_4, 0));
    ESP_ERROR_CHECK(spi_device_transmit(s_display_handle, &transaction));
}

void m5stack_dial_v1_1_platform_boot_controller(void)
{
    configure_output_gpio(GPIO_NUM_46);
    configure_output_gpio(GPIO_NUM_9);
    configure_output_gpio(GPIO_NUM_3);
    configure_output_gpio(GPIO_NUM_8);
    configure_output_gpio(GPIO_NUM_4);

    configure_input_gpio(GPIO_NUM_14, true);
    configure_input_gpio(GPIO_NUM_10, true);
    configure_input_gpio(GPIO_NUM_41, true);
    configure_input_gpio(GPIO_NUM_40, true);

    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_4, 1));
}

void m5stack_dial_v1_1_platform_boot_internal_i2c(void)
{
    if (s_internal_i2c_bus != NULL) {
        return;
    }

    const i2c_master_bus_config_t bus_config = {
        .i2c_port = M5DIAL_I2C_PORT,
        .sda_io_num = GPIO_NUM_11,
        .scl_io_num = GPIO_NUM_12,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .intr_priority = 0,
        .trans_queue_depth = 4,
        .flags.enable_internal_pullup = 1,
        .flags.allow_pd = 0,
    };

    ESP_ERROR_CHECK(i2c_new_master_bus(&bus_config, &s_internal_i2c_bus));

    const i2c_device_config_t rtc_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x51,
        .scl_speed_hz = M5DIAL_I2C_SPEED_HZ,
        .scl_wait_us = 0,
        .flags.disable_ack_check = 0,
    };
    ESP_ERROR_CHECK(i2c_master_bus_add_device(s_internal_i2c_bus, &rtc_config, &s_rtc_handle));

    const i2c_device_config_t rfid_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x28,
        .scl_speed_hz = M5DIAL_I2C_SPEED_HZ,
        .scl_wait_us = 0,
        .flags.disable_ack_check = 0,
    };
    ESP_ERROR_CHECK(i2c_master_bus_add_device(s_internal_i2c_bus, &rfid_config, &s_rfid_handle));

    const i2c_device_config_t touch_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x38,
        .scl_speed_hz = M5DIAL_I2C_SPEED_HZ,
        .scl_wait_us = 0,
        .flags.disable_ack_check = 0,
    };
    ESP_ERROR_CHECK(i2c_master_bus_add_device(s_internal_i2c_bus, &touch_config, &s_touch_handle));
}

void m5stack_dial_v1_1_platform_boot_rtc(void)
{
    if (s_internal_i2c_bus != NULL) {
        ESP_ERROR_CHECK(i2c_master_probe(s_internal_i2c_bus, 0x51, 50));
    }
}

void m5stack_dial_v1_1_platform_boot_touch(void)
{
    if (s_internal_i2c_bus != NULL) {
        ESP_ERROR_CHECK(i2c_master_probe(s_internal_i2c_bus, 0x38, 50));
    }
}

void m5stack_dial_v1_1_platform_boot_rfid(void)
{
    m5stack_dial_v1_1_platform_rfid_reset_set(false);
    vTaskDelay(pdMS_TO_TICKS(10));
    m5stack_dial_v1_1_platform_rfid_reset_set(true);
    vTaskDelay(pdMS_TO_TICKS(10));
    if (s_internal_i2c_bus != NULL) {
        ESP_ERROR_CHECK(i2c_master_probe(s_internal_i2c_bus, 0x28, 50));
    }
}

void m5stack_dial_v1_1_platform_boot_display_spi(void)
{
    if (s_spi_ready) {
        return;
    }

    const spi_bus_config_t bus_config = {
        .mosi_io_num = GPIO_NUM_5,
        .miso_io_num = -1,
        .sclk_io_num = GPIO_NUM_6,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .data4_io_num = -1,
        .data5_io_num = -1,
        .data6_io_num = -1,
        .data7_io_num = -1,
        .max_transfer_sz = 4,
        .flags = SPICOMMON_BUSFLAG_MASTER | SPICOMMON_BUSFLAG_SCLK | SPICOMMON_BUSFLAG_MOSI,
        .isr_cpu_id = ESP_INTR_CPU_AFFINITY_AUTO,
        .intr_flags = 0,
    };
    ESP_ERROR_CHECK(spi_bus_initialize(M5DIAL_SPI_HOST, &bus_config, SPI_DMA_CH_AUTO));

    const spi_device_interface_config_t device_config = {
        .command_bits = 0,
        .address_bits = 0,
        .dummy_bits = 0,
        .mode = 0,
        .clock_source = SPI_CLK_SRC_DEFAULT,
        .duty_cycle_pos = 128,
        .cs_ena_pretrans = 0,
        .cs_ena_posttrans = 0,
        .clock_speed_hz = M5DIAL_SPI_SPEED_HZ,
        .input_delay_ns = 0,
        .sample_point = SPI_SAMPLING_POINT_PHASE_0,
        .spics_io_num = GPIO_NUM_7,
        .flags = SPI_DEVICE_HALFDUPLEX,
        .queue_size = 1,
        .pre_cb = NULL,
        .post_cb = NULL,
    };
    ESP_ERROR_CHECK(spi_bus_add_device(M5DIAL_SPI_HOST, &device_config, &s_display_handle));
    s_spi_ready = true;
}

void m5stack_dial_v1_1_platform_boot_display(void)
{
    if (!s_spi_ready || s_display_handle == NULL) {
        ESP_LOGW(TAG, "Display SPI bus not ready");
        return;
    }

    m5stack_dial_v1_1_platform_rfid_reset_set(false);
    vTaskDelay(pdMS_TO_TICKS(20));
    m5stack_dial_v1_1_platform_rfid_reset_set(true);
    vTaskDelay(pdMS_TO_TICKS(120));

    send_display_command(0x11);
    vTaskDelay(pdMS_TO_TICKS(120));
    send_display_command(0x29);
}

void m5stack_dial_v1_1_platform_power_hold_set(bool enabled)
{
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_46, enabled ? 1 : 0));
}

void m5stack_dial_v1_1_platform_lcd_backlight_set(bool enabled)
{
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_9, enabled ? 1 : 0));
}

void m5stack_dial_v1_1_platform_buzzer_set(bool enabled)
{
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_3, enabled ? 1 : 0));
}

void m5stack_dial_v1_1_platform_rfid_reset_set(bool enabled)
{
    ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_8, enabled ? 0 : 1));
}

bool m5stack_dial_v1_1_platform_touch_interrupt_read(void)
{
    return gpio_get_level(GPIO_NUM_14) == 0;
}

bool m5stack_dial_v1_1_platform_rfid_interrupt_read(void)
{
    return gpio_get_level(GPIO_NUM_10) == 0;
}

bool m5stack_dial_v1_1_platform_encoder_phase_a_read(void)
{
    return gpio_get_level(GPIO_NUM_41) != 0;
}

bool m5stack_dial_v1_1_platform_encoder_phase_b_read(void)
{
    return gpio_get_level(GPIO_NUM_40) != 0;
}


