# Keys

This folder is reserved for per-unit security material.

Planned use:

- one AES key per physical unit
- one asymmetric key pair per physical unit
- manifests that link key material back to the stable unit id from discovery

Rules:

- do not commit private keys or raw AES key files to git
- only commit documentation, templates, and non-secret manifest examples when needed
- keep generated key material organized by stable unit id so identical board models still remain distinct

The Stage 2 discovery/database model should eventually link each stable unit id to:

- an AES key record
- a public-key record
- a private-key storage reference
- creation and rotation timestamps
