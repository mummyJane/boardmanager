#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "m5stack_dial_v1_1.h"
#include "m5stack_dial_v1_1_platform.h"

static const char *status_text(bool value)
{
    return value ? "PASS" : "FAIL";
}

static void print_self_test(const m5stack_dial_v1_1_self_test_t *result)
{
    printf("Dial smoke test summary\n");
    printf("  controller gpio path: %s\n", status_text(result->controller_ready));
    printf("  internal i2c bus: %s\n", status_text(result->internal_i2c_ready));
    printf("  rtc present: %s\n", status_text(result->rtc_present));
    printf("  touch present: %s\n", status_text(result->touch_present));
    printf("  rfid present: %s\n", status_text(result->rfid_present));
    printf("  display spi path: %s\n", status_text(result->display_spi_ready));
    printf("  display command path: %s\n", status_text(result->display_command_path_ready));
    printf("  touch irq active: %s\n", result->touch_interrupt_active ? "YES" : "NO");
    printf("  rfid irq active: %s\n", result->rfid_interrupt_active ? "YES" : "NO");
    printf("  encoder phases: A=%d B=%d\n", result->encoder_phase_a ? 1 : 0, result->encoder_phase_b ? 1 : 0);
}

static void run_visual_and_audio_check(void)
{
    printf("Exercising backlight and buzzer\n");
    m5stack_dial_v1_1_lcd_backlight_set(false);
    vTaskDelay(pdMS_TO_TICKS(250));
    m5stack_dial_v1_1_lcd_backlight_set(true);
    vTaskDelay(pdMS_TO_TICKS(250));
    m5stack_dial_v1_1_buzzer_set(true);
    vTaskDelay(pdMS_TO_TICKS(120));
    m5stack_dial_v1_1_buzzer_set(false);
}

void app_main(void)
{
    m5stack_dial_v1_1_self_test_t result = {0};

    printf("Board Manager dial smoke test starting\n");
    m5stack_dial_v1_1_init();
    m5stack_dial_v1_1_platform_get_self_test(&result);
    printf("Board init complete for %s using %s\n",
        m5stack_dial_v1_1_descriptor.display_name,
        m5stack_dial_v1_1_descriptor.platform_sdk);

    print_self_test(&result);
    run_visual_and_audio_check();

    for (;;) {
        m5stack_dial_v1_1_platform_get_self_test(&result);
        printf("Live inputs: touch_irq=%d rfid_irq=%d enc_a=%d enc_b=%d\n",
            result.touch_interrupt_active ? 1 : 0,
            result.rfid_interrupt_active ? 1 : 0,
            result.encoder_phase_a ? 1 : 0,
            result.encoder_phase_b ? 1 : 0);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
