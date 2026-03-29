#include "p_nucleo_usb001_f072rb_v1.h"
#include <stddef.h>

void p_nucleo_usb001_f072rb_v1_platform_boot_controller(void);
void p_nucleo_usb001_f072rb_v1_platform_boot_usbpd_i2c(void);
void p_nucleo_usb001_f072rb_v1_platform_boot_usb_pd_controller(void);
void p_nucleo_usb001_f072rb_v1_platform_heartbeat_led_set(bool enabled);
void p_nucleo_usb001_f072rb_v1_platform_vconn_enable_set(bool enabled);
void p_nucleo_usb001_f072rb_v1_platform_buzzer_enable_set(bool enabled);
bool p_nucleo_usb001_f072rb_v1_platform_board_detect_read(void);
bool p_nucleo_usb001_f072rb_v1_platform_user_button_read(void);

static void p_nucleo_usb001_f072rb_v1_boot_controller(void)
{
    p_nucleo_usb001_f072rb_v1_platform_boot_controller();
}

static void p_nucleo_usb001_f072rb_v1_boot_usbpd_i2c(void)
{
    p_nucleo_usb001_f072rb_v1_platform_boot_usbpd_i2c();
}

static void p_nucleo_usb001_f072rb_v1_boot_usb_pd_controller(void)
{
    p_nucleo_usb001_f072rb_v1_platform_boot_usb_pd_controller();
}

static const board_io_descriptor_t p_nucleo_usb001_f072rb_v1_io[] = {
    { "heartbeat_led", BOARD_IO_DIGITAL_OUTPUT, "status_indicator", "PA5", "PA5", "LD2", true },
    { "vconn_enable", BOARD_IO_DIGITAL_OUTPUT, "usb_pd_vconn_enable", "PA6", "PA6", "VCONN_SWITCH", true },
    { "buzzer_enable", BOARD_IO_DIGITAL_OUTPUT, "audio_alert", "PA7", "PA7", "BUZZER", true },
    { "board_detect", BOARD_IO_DIGITAL_INPUT, "daughterboard_presence", "PA8", "PA8", "BOARD_DETECT", false },
    { "user_button", BOARD_IO_DIGITAL_INPUT, "user_button", "PC13", "PC13", "B1", false },
};

const board_descriptor_t p_nucleo_usb001_f072rb_v1_descriptor = {
    "p_nucleo_usb001_f072rb_v1",
    "P-NUCLEO-USB001 (Nucleo-F072RB)",
    "1.0",
    "STM32F072",
    "STM32F072RBT6 LQFP64",
    "stm32cube",
    5,
    p_nucleo_usb001_f072rb_v1_io
};

void p_nucleo_usb001_f072rb_v1_init(void)
{
    /* Boot sequence generated for stm32cube. */
    p_nucleo_usb001_f072rb_v1_boot_controller();
    p_nucleo_usb001_f072rb_v1_boot_usbpd_i2c();
    p_nucleo_usb001_f072rb_v1_boot_usb_pd_controller();
    p_nucleo_usb001_f072rb_v1_heartbeat_led_set(false);
    p_nucleo_usb001_f072rb_v1_vconn_enable_set(false);
    p_nucleo_usb001_f072rb_v1_buzzer_enable_set(false);
}

void p_nucleo_usb001_f072rb_v1_heartbeat_led_set(bool enabled)
{
    p_nucleo_usb001_f072rb_v1_platform_heartbeat_led_set(enabled);
}

void p_nucleo_usb001_f072rb_v1_vconn_enable_set(bool enabled)
{
    p_nucleo_usb001_f072rb_v1_platform_vconn_enable_set(enabled);
}

void p_nucleo_usb001_f072rb_v1_buzzer_enable_set(bool enabled)
{
    p_nucleo_usb001_f072rb_v1_platform_buzzer_enable_set(enabled);
}

bool p_nucleo_usb001_f072rb_v1_board_detect_read(void)
{
    return p_nucleo_usb001_f072rb_v1_platform_board_detect_read();
}

bool p_nucleo_usb001_f072rb_v1_user_button_read(void)
{
    return p_nucleo_usb001_f072rb_v1_platform_user_button_read();
}
