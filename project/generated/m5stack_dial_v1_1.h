#ifndef M5STACK_DIAL_V1_1_H
#define M5STACK_DIAL_V1_1_H

#include "../firmware-common/board_api.h"

extern const board_descriptor_t m5stack_dial_v1_1_descriptor;

void m5stack_dial_v1_1_init(void);
void m5stack_dial_v1_1_power_hold_set(bool enabled);
void m5stack_dial_v1_1_lcd_backlight_set(bool enabled);
void m5stack_dial_v1_1_buzzer_set(bool enabled);
void m5stack_dial_v1_1_rfid_reset_set(bool enabled);
bool m5stack_dial_v1_1_touch_interrupt_read(void);
bool m5stack_dial_v1_1_rfid_interrupt_read(void);
bool m5stack_dial_v1_1_encoder_phase_a_read(void);
bool m5stack_dial_v1_1_encoder_phase_b_read(void);

#endif
