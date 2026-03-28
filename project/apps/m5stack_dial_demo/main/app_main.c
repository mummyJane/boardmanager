#include <stdio.h>

#include "m5stack_dial_v1_1.h"

void app_main(void)
{
    printf("Board Manager bootstrap app starting\n");
    m5stack_dial_v1_1_init();
    printf("Board init complete for %s using %s\n",
        m5stack_dial_v1_1_descriptor.display_name,
        m5stack_dial_v1_1_descriptor.platform_sdk);
}
