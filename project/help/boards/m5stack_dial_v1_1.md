# M5Stack Dial V1.1

## Summary

ESP32-S3 based round-display controller using the M5StampS3 module. Current model coverage includes power hold, display SPI, internal I2C, RTC, touch, RFID, encoder, buzzer, and exposed Port A / Port B connectors.

## Boot Order

1. Controller module
2. Power-hold signal
3. Internal I2C bus
4. RTC
5. Touch controller
6. RFID controller
7. Display SPI bus
8. Display controller
9. Backlight signal

## Bench Notes

- `COM3` and `COM5` are currently attached as Dial units.
- `COM5` has already been validated as a distinct flash target in a multi-unit setup.

## References

- Product page: [M5Dial](https://docs.m5stack.com/en/core/M5Dial)
- Pin map: [M5Dial V1.1](https://docs.m5stack.com/en/core/M5Dial%20V1.1)
