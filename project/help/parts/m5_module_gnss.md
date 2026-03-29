# M5Stack Module GNSS

## What It Is

This M5Stack expansion module combines a u-blox NEO-M9N GNSS receiver with motion and environmental sensors for M5-Bus hosts such as CoreS3.

## Init Contract

- Select the correct M5-Bus DIP-switch profile for the host board.
- Bring up the mapped UART to the GNSS receiver.
- If sensor data is needed, bring up the module sensor I2C path as documented for the host.

## Smoke Test Meaning

A pass means the GNSS UART path is active and any wired sensor bus responds. Satellite lock quality depends on antenna placement and should be reported separately.

## High-Level API Usage

- `gnss_module_get_fix`: read the current GNSS solution.
- `gnss_module_get_motion`: read IMU or environmental data exposed by the module.
- `gnss_module_get_pps_state`: inspect the PPS timing line if mapped.

## References

- Product page: [Module GNSS](https://docs.m5stack.com/en/products/sku/M135)
- Host pin-switch guide: [GNSS DIP Switch Guide](https://docs.m5stack.com/en/guide/dip_switch/module_gnss/pins_change)
