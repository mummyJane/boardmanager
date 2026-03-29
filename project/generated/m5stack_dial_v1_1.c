#include "m5stack_dial_v1_1.h"
#include <stddef.h>

void m5stack_dial_v1_1_platform_boot_controller(void);
void m5stack_dial_v1_1_platform_boot_internal_i2c(void);
void m5stack_dial_v1_1_platform_boot_rtc(void);
void m5stack_dial_v1_1_platform_boot_touch(void);
void m5stack_dial_v1_1_platform_boot_rfid(void);
void m5stack_dial_v1_1_platform_boot_display_spi(void);
void m5stack_dial_v1_1_platform_boot_display(void);
void m5stack_dial_v1_1_platform_power_hold_set(bool enabled);
void m5stack_dial_v1_1_platform_lcd_backlight_set(bool enabled);
void m5stack_dial_v1_1_platform_buzzer_set(bool enabled);
void m5stack_dial_v1_1_platform_rfid_reset_set(bool enabled);
bool m5stack_dial_v1_1_platform_touch_interrupt_read(void);
bool m5stack_dial_v1_1_platform_rfid_interrupt_read(void);
bool m5stack_dial_v1_1_platform_encoder_phase_a_read(void);
bool m5stack_dial_v1_1_platform_encoder_phase_b_read(void);

static void m5stack_dial_v1_1_boot_controller(void)
{
    m5stack_dial_v1_1_platform_boot_controller();
}

static void m5stack_dial_v1_1_boot_internal_i2c(void)
{
    m5stack_dial_v1_1_platform_boot_internal_i2c();
}

static void m5stack_dial_v1_1_boot_rtc(void)
{
    m5stack_dial_v1_1_platform_boot_rtc();
}

static void m5stack_dial_v1_1_boot_touch(void)
{
    m5stack_dial_v1_1_platform_boot_touch();
}

static void m5stack_dial_v1_1_boot_rfid(void)
{
    m5stack_dial_v1_1_platform_boot_rfid();
}

static void m5stack_dial_v1_1_boot_display_spi(void)
{
    m5stack_dial_v1_1_platform_boot_display_spi();
}

static void m5stack_dial_v1_1_boot_display(void)
{
    m5stack_dial_v1_1_platform_boot_display();
}

static const char *const m5stack_dial_v1_1_capabilities[] = {
    "display",
    "rfid",
    "rotaryEncoder",
    "rtc",
    "touch",
    "usb",
    "wifi",
};

static const board_io_descriptor_t m5stack_dial_v1_1_io[] = {
    { "power_hold", BOARD_IO_DIGITAL_OUTPUT, "power_latch", "GPIO46", "G46", "POWER_HOLD", true },
    { "lcd_backlight", BOARD_IO_DIGITAL_OUTPUT, "display_backlight", "GPIO9", "G9", "GC9A01_BL", true },
    { "buzzer", BOARD_IO_DIGITAL_OUTPUT, "audio_alert", "GPIO3", "G3", "BUZZER", true },
    { "rfid_reset", BOARD_IO_DIGITAL_OUTPUT, "rfid_reset", "GPIO8", "G8", "WS1850S_RST", false },
    { "touch_interrupt", BOARD_IO_DIGITAL_INPUT, "touch_irq", "GPIO14", "G14", "FT3267_INT", false },
    { "rfid_interrupt", BOARD_IO_DIGITAL_INPUT, "rfid_irq", "GPIO10", "G10", "WS1850S_IRQ", false },
    { "encoder_phase_a", BOARD_IO_DIGITAL_INPUT, "encoder_phase_a", "GPIO41", "G41", "ROTARY_ENCODER_A", true },
    { "encoder_phase_b", BOARD_IO_DIGITAL_INPUT, "encoder_phase_b", "GPIO40", "G40", "ROTARY_ENCODER_B", true },
};

const board_descriptor_t m5stack_dial_v1_1_descriptor = {
    "m5stack_dial_v1_1",
    "M5Stack Dial V1.1",
    "1.1",
    "ESP32-S3",
    "ESP32-S3FN8",
    "esp-idf",
    7,
    m5stack_dial_v1_1_capabilities,
    8,
    m5stack_dial_v1_1_io
};

void m5stack_dial_v1_1_init(void)
{
    /* Boot sequence generated for esp-idf. */
    m5stack_dial_v1_1_boot_controller();
    m5stack_dial_v1_1_power_hold_set(true);
    m5stack_dial_v1_1_boot_internal_i2c();
    m5stack_dial_v1_1_boot_rtc();
    m5stack_dial_v1_1_boot_touch();
    m5stack_dial_v1_1_boot_rfid();
    m5stack_dial_v1_1_boot_display_spi();
    m5stack_dial_v1_1_boot_display();
    m5stack_dial_v1_1_lcd_backlight_set(true);
}

void m5stack_dial_v1_1_power_hold_set(bool enabled)
{
    m5stack_dial_v1_1_platform_power_hold_set(enabled);
}

void m5stack_dial_v1_1_lcd_backlight_set(bool enabled)
{
    m5stack_dial_v1_1_platform_lcd_backlight_set(enabled);
}

void m5stack_dial_v1_1_buzzer_set(bool enabled)
{
    m5stack_dial_v1_1_platform_buzzer_set(enabled);
}

void m5stack_dial_v1_1_rfid_reset_set(bool enabled)
{
    m5stack_dial_v1_1_platform_rfid_reset_set(enabled);
}

bool m5stack_dial_v1_1_touch_interrupt_read(void)
{
    return m5stack_dial_v1_1_platform_touch_interrupt_read();
}

bool m5stack_dial_v1_1_rfid_interrupt_read(void)
{
    return m5stack_dial_v1_1_platform_rfid_interrupt_read();
}

bool m5stack_dial_v1_1_encoder_phase_a_read(void)
{
    return m5stack_dial_v1_1_platform_encoder_phase_a_read();
}

bool m5stack_dial_v1_1_encoder_phase_b_read(void)
{
    return m5stack_dial_v1_1_platform_encoder_phase_b_read();
}
