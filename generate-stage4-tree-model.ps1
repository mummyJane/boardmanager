param()

$ErrorActionPreference = 'Stop'
node project/scripts/generate-stage4-tree-model.mjs
if ($LASTEXITCODE -ne 0) {
    throw "Stage 4 tree-model generation failed with exit code $LASTEXITCODE"
}