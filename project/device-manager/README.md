# Device Manager

This folder now contains the first Milestone 2 discovery slice.

## Scope

- scan currently attached units on the local host
- capture transport and USB identity details
- capture stable identifiers such as USB instance path, MAC, and serial-like values where available
- capture ESP32 short firmware signatures where possible
- match observations back to known board definitions from Stage 1
- persist the current discovery snapshot in a simple local inventory file

## Current Files

- `schema/device-inventory.schema.json`: JSON schema for persisted discovery output
- `data/inventory.json`: latest local discovery snapshot

The first pass is intentionally local and Windows-focused. It is designed to give the future service and database layers a stable observation format before introducing a daemon or web API.

## Identity Rules

The inventory must preserve enough identity information to distinguish same-model units from one another.

Current priority order for the stable unit key is:

1. chip MAC, if available
2. USB instance path
3. serial number, if a future probe provides one
4. current transport port as a temporary fallback only

This allows two physically attached Dial units to remain distinct even though they map to the same board definition.
