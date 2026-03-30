# Stage 4 Web UI Model

This folder holds the first Stage 4 tree model that the later web interface and service layer will consume.

## Runtime Direction

- the Milestone 4 web server should be Python-based
- existing Node.js scripts may still generate or validate model artifacts during the transition
- the web server should serve stable JSON derived from this model rather than reconstructing tree views ad hoc in the browser

## Current Artifacts

- `data/stage4-tree-model.json`: generated tree snapshot built from the current board, part, project, and help definitions
- `schema/stage4-tree-model.schema.json`: shape definition for the generated tree snapshot

## Tree Structure

The Stage 4 model is rooted in three main areas:

- `modules-root`: reusable modules and device-level catalog entries
- `boards-root`: board assemblies with controller, buses, devices, signals, connectors, and help references
- `projects-root`: deployable board-targeted projects with build and deployment metadata

The current model is intentionally UI-oriented:

- modules are a common catalog abstraction over the current reusable `parts/modules` and `parts/devices` definitions
- boards remain board assemblies with local wiring and configuration
- projects remain board-targeted build/run definitions
- the generated tree preserves source paths and help references so the later Python service can expose both the tree and raw source links

## Generation And Validation

- Generate with `node project/scripts/generate-stage4-tree-model.mjs`
- Validate with `node project/scripts/validate-stage4-tree-model.mjs`
- `validate.ps1` now includes Stage 4 tree-model validation in the standard repo validation flow