# Decisions

## 2026-03-28 14:30 Europe/London

- Use JSON for the first iteration of board definitions to keep review and scripting simple.
- Use generated C headers and C source stubs as the firmware integration layer for the first milestone.
- Keep the first milestone dependency-light by using a plain Node.js generator script with no third-party packages.
- Reserve `project/web` and `project/device-manager` for later milestones instead of prematurely scaffolding framework-specific stacks.
- Commit generated firmware artifacts so schema and API-surface changes stay reviewable in git.
- Extend the board-definition schema with `power`, `buses`, and `connectors` fields so complex boards such as M5Stack Dial can be represented without flattening everything into GPIO-only entries.
- Treat product pages and official pin maps as the preferred source for initial board profiles.
- Model reusable parts separately from boards so MCU dies, packages, modules, and peripheral devices can be shared across multiple board definitions.
- Make the board file an assembly-and-binding layer, not the sole source of every part's intrinsic metadata.
