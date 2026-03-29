# Keys

This folder stores local-only security material for Board Manager.

Current Stage 2 layout:

- `keys/root/`: local root signing keypair and root manifest
- `keys/units/<unit>/`: per-unit AES key, per-unit identity keypair, signed payload, and unit manifest
- `keys/key-manifest-index.json`: local index that links stable unit ids to their current key manifests

Current rules:

- do not commit private keys, raw AES keys, or local manifests to git
- keep all generated key material under `keys/`
- the local root signing keypair signs the per-unit key payloads
- for now the Board Manager generates per-unit keys locally
- later stages may replace the Board Manager-generated unit identity keypair with one generated on the board during setup

Each physical unit should have:

- one AES-256 key
- one asymmetric identity keypair
- one signed unit-key payload
- one local manifest linked to the stable unit id from discovery

Top-level tooling:

- `./manage-unit-keys.ps1 -EnsureRootOnly`
- `./manage-unit-keys.ps1 -AllUnits`
- `./manage-unit-keys.ps1 -Unit "<stableKey>" -Rotate`

The tracked schemas for the local manifest format live under `project/device-manager/schema/`.
