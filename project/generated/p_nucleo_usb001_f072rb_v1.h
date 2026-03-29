#ifndef P_NUCLEO_USB001_F072RB_V1_H
#define P_NUCLEO_USB001_F072RB_V1_H

#include "board_api.h"

extern const board_descriptor_t p_nucleo_usb001_f072rb_v1_descriptor;

void p_nucleo_usb001_f072rb_v1_init(void);
void p_nucleo_usb001_f072rb_v1_heartbeat_led_set(bool enabled);
void p_nucleo_usb001_f072rb_v1_vconn_enable_set(bool enabled);
void p_nucleo_usb001_f072rb_v1_buzzer_enable_set(bool enabled);
bool p_nucleo_usb001_f072rb_v1_board_detect_read(void);
bool p_nucleo_usb001_f072rb_v1_user_button_read(void);

#endif
