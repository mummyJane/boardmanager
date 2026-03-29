# u-blox NEO-M9N

## What It Is

NEO-M9N is the GNSS receiver used inside the M5Stack GNSS module attached to the CoreS3 bench unit.

## Init Contract

- Configure the mapped UART first.
- Confirm incoming NMEA or UBX traffic at the expected baud rate.
- Wire PPS if timing diagnostics are required.

## Smoke Test Meaning

A pass means the UART path is alive and frames are arriving. A missing position fix can still happen indoors and does not mean the part is absent.

## High-Level API Usage

- `gnss_read_frame`: read raw NMEA or UBX traffic.
- `gnss_get_fix`: return the latest parsed solution.
- `gnss_configure_rate`: set the navigation update cadence.

## References

- Datasheet: [NEO-M9N](https://content.u-blox.com/sites/default/files/NEO-M9N_DataSheet_UBX-19014286.pdf)
- Product page: [u-blox NEO-M9N](https://www.u-blox.com/en/product/neo-m9n-module)
