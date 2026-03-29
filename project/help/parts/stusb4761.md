# STUSB4761 USB PD Controller

## What It Is

STUSB4761 is a standalone USB Type-C and USB Power Delivery controller used in ST USB PD reference and evaluation hardware.

## Init Contract

- Configure the board I2C bus used for USB PD management.
- Read controller status before enabling board-local VCONN or provider policy.
- Apply any NVM or PDO profile configuration only after a successful probe.

## Smoke Test Meaning

A pass means the controller responds on I2C and returns status data. PD negotiation outcomes still depend on the attached cable and partner device.

## High-Level API Usage

- `usbpd_read_status`: report power-delivery and fault state.
- `usbpd_set_profile`: select the active source profile.
- `usbpd_store_nvm`: persist controller configuration when required.

## References

- Datasheet: [STUSB4761](https://www.st.com/resource/en/datasheet/stusb4761.pdf)
- Product page: [STUSB4761](https://www.st.com/en/product/STUSB4761)
