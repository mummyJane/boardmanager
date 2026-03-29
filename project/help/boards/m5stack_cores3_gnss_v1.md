# M5Stack CoreS3 + GNSS Module

## Summary

Concrete bench assembly that combines the CoreS3 controller with an attached M5Stack GNSS expansion module. Current model coverage includes the CoreS3 internal PMU and RTC on system I2C plus the GNSS UART and PPS path.

## Boot Order

1. Controller module
2. Internal I2C bus
3. RTC
4. PMU
5. GNSS UART
6. GNSS module

## Bench Notes

- This unit is currently attached on `COM4`.
- The bench fingerprint already records MAC `48:27:e2:66:b0:04`.
- The current schema models the physical stack as one concrete board assembly; future schema work should support nested accessory-module composition directly.

## References

- Controller: [CoreS3](https://docs.m5stack.com/en/core/CoreS3)
- GNSS module: [Module GNSS](https://docs.m5stack.com/en/products/sku/M135)
- Host pin guide: [GNSS DIP Switch Guide](https://docs.m5stack.com/en/guide/dip_switch/module_gnss/pins_change)
