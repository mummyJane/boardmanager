# P-NUCLEO-USB001 (Nucleo-F072RB)

## Summary

Concrete bench assembly for the ST USB Type-C and Power Delivery pack based on the Nucleo-F072RB controller. Current model coverage includes the Nucleo controller, core status and control GPIOs, and the USB PD management I2C path.

## Boot Order

1. Controller module
2. USB PD I2C bus
3. USB PD controller
4. Status LED off
5. VCONN disabled
6. Buzzer disabled

## Bench Notes

- This unit is currently attached on `COM6` through the ST-LINK virtual COM port.
- The current board model is intentionally conservative; the wider power-path and policy hardware can be expanded as more bench detail is captured.

## References

- Pack page: [P-NUCLEO-USB001](https://www.st.com/en/evaluation-tools/p-nucleo-usb001.html)
- Controller board: [NUCLEO-F072RB](https://estore.st.com/en/nucleo-f072rb-cpn.html)
- Quick-start reference: [STSW-STUSB006 Quick Start](https://www.st.com/resource/en/product_presentation/stswstusb006quickstartv1.pdf)
