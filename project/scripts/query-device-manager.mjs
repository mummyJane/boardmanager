import { parseQueryArgs, renderQueryText, runQuery } from "./device-manager-query-lib.mjs";

async function main() {
  const args = parseQueryArgs(process.argv.slice(2));
  const payload = await runQuery(args);

  if (args.format === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(renderQueryText(args.view, payload.items));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
