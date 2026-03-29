#ifndef M5STACK_CORES3_GNSS_V1_PLATFORM_H
#define M5STACK_CORES3_GNSS_V1_PLATFORM_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

size_t m5stack_cores3_gnss_v1_platform_scan_internal_i2c(uint8_t *addresses, size_t max_count);
bool m5stack_cores3_gnss_v1_platform_gnss_pps_read(void);

#endif
