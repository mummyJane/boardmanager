import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runQuery } from "./device-manager-query-lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataRoot = path.join(projectRoot, "device-manager", "data");
const defaultOutputRoot = path.join(projectRoot, "device-manager", "reports");

function parseArgs(argv) {
  const result = {
    outputRoot: defaultOutputRoot,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--output-root") {
      result.outputRoot = next ?? result.outputRoot;
      index += 1;
    }
  }

  return result;
}

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(path.join(dataRoot, name), "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.outputRoot, { recursive: true });

  const inventory = await readJson("inventory.json", { generatedAt: null, host: null, units: [] });
  const history = await readJson("unit-history.json", { generatedAt: null, host: null, units: [], families: [] });
  const runs = await readJson("discovery-runs.json", { generatedAt: null, host: null, runs: [] });
  const annotations = await readJson("unit-annotations.json", { updatedAt: null, units: [] });

  const unitsView = await runQuery({ view: "units", format: "json", limit: 1000, presentOnly: false, family: null, unit: null });
  const familiesView = await runQuery({ view: "families", format: "json", limit: 1000, presentOnly: false, family: null, unit: null });
  const changesView = await runQuery({ view: "changes", format: "json", limit: 1000, presentOnly: false, family: null, unit: null });
  const diffView = await runQuery({ view: "diff", format: "json", limit: 1000, presentOnly: false, family: null, unit: null });

  const currentBenchReport = {
    reportType: "current-bench",
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: inventory.generatedAt ?? history.generatedAt ?? runs.generatedAt ?? null,
    host: inventory.host ?? history.host ?? runs.host ?? null,
    summary: {
      presentUnitCount: unitsView.items.filter((unit) => unit.present !== false).length,
      knownFamilyCount: familiesView.items.length,
      currentRunId: runs.runs?.at(-1)?.runId ?? null,
      previousRunId: runs.runs?.at(-2)?.runId ?? null,
    },
    units: unitsView.items,
    families: familiesView.items,
    latestDiff: {
      previousRunAt: diffView.previousRunAt ?? null,
      currentRunAt: diffView.currentRunAt ?? null,
      items: diffView.items,
    },
  };

  const unitHistoryReport = {
    reportType: "unit-history",
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: history.generatedAt ?? inventory.generatedAt ?? runs.generatedAt ?? null,
    host: history.host ?? inventory.host ?? runs.host ?? null,
    summary: {
      unitCount: Array.isArray(history.units) ? history.units.length : 0,
      familyCount: Array.isArray(history.families) ? history.families.length : 0,
      discoveryRunCount: Array.isArray(runs.runs) ? runs.runs.length : 0,
      annotatedUnitCount: Array.isArray(annotations.units) ? annotations.units.length : 0,
    },
    history,
    annotations,
    recentChanges: changesView.items,
    latestRuns: (runs.runs ?? []).slice(-10),
  };

  const currentBenchPath = path.join(args.outputRoot, "current-bench-report.json");
  const unitHistoryPath = path.join(args.outputRoot, "unit-history-report.json");
  const manifestPath = path.join(args.outputRoot, "report-manifest.json");

  await writeFile(currentBenchPath, `${JSON.stringify(currentBenchReport, null, 2)}\n`, "utf8");
  await writeFile(unitHistoryPath, `${JSON.stringify(unitHistoryReport, null, 2)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    outputRoot: args.outputRoot,
    files: [
      { name: "current-bench-report.json", reportType: currentBenchReport.reportType },
      { name: "unit-history-report.json", reportType: unitHistoryReport.reportType },
    ],
  }, null, 2)}\n`, "utf8");

  console.log(`Exported reports to ${args.outputRoot}`);
  console.log(`- ${currentBenchPath}`);
  console.log(`- ${unitHistoryPath}`);
  console.log(`- ${manifestPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
