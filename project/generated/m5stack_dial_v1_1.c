#include "m5stack_dial_v1_1.h"

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
    8,
    m5stack_dial_v1_1_io
};

void m5stack_dial_v1_1_init(void)
{
    /* TODO: configure MCU pins and peripherals for this board. */
}

void m5stack_dial_v1_1_power_hold_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

void m5stack_dial_v1_1_lcd_backlight_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

void m5stack_dial_v1_1_buzzer_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

void m5stack_dial_v1_1_rfid_reset_set(bool enabled)
{
    (void)enabled;
    /* TODO: drive the mapped MCU output. */
}

bool m5stack_dial_v1_1_touch_interrupt_read(void)
{
    /* TODO: read the mapped MCU input. */
    return false;
}

bool m5stack_dial_v1_1_rfid_interrupt_read(void)
{
    /* TODO: read the mapped MCU input. */
    return false;
}

bool m5stack_dial_v1_1_encoder_phase_a_read(void)
{
    /* TODO: read the mapped MCU input. */
    return false;
}

bool m5stack_dial_v1_1_encoder_phase_b_read(void)
{
    /* TODO: read the mapped MCU input. */
    return false;
}
