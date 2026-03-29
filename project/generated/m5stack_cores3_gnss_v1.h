#ifndef M5STACK_CORES3_GNSS_V1_H
#define M5STACK_CORES3_GNSS_V1_H

#include "board_api.h"

extern const board_descriptor_t m5stack_cores3_gnss_v1_descriptor;

void m5stack_cores3_gnss_v1_init(void);
bool m5stack_cores3_gnss_v1_gnss_pps_read(void);

#endif
