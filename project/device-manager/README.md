# Device Manager

This folder now contains the first Milestone 2 discovery slice.

## Scope

- scan currently attached units on the local host
- capture transport and USB identity details
- capture ESP32 MACs and short firmware signatures where possible
- match observations back to known board definitions from Stage 1
- persist the current discovery snapshot in a simple local inventory file

## Current Files

- `schema/device-inventory.schema.json`: JSON schema for persisted discovery output
- `data/inventory.json`: latest local discovery snapshot

The first pass is intentionally local and Windows-focused. It is designed to give the future service and database layers a stable observation format before introducing a daemon or web API.
