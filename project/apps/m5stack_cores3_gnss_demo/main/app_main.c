#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "m5stack_cores3_gnss_v1.h"

void app_main(void)
{
    printf("Board Manager CoreS3 GNSS bring-up starting\n");
    m5stack_cores3_gnss_v1_init();
    printf("Board init complete for %s using %s\n",
        m5stack_cores3_gnss_v1_descriptor.display_name,
        m5stack_cores3_gnss_v1_descriptor.platform_sdk);
    printf("GNSS PPS input path is mapped as %s on %s\n",
        m5stack_cores3_gnss_v1_descriptor.io[0].name,
        m5stack_cores3_gnss_v1_descriptor.io[0].mcu_signal);

    for (;;) {
        printf("Live GNSS PPS state: %d\n", m5stack_cores3_gnss_v1_gnss_pps_read() ? 1 : 0);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
