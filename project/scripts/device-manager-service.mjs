import http from "node:http";
import { URL } from "node:url";
import { parseQueryArgs, runQuery } from "./device-manager-query-lib.mjs";
import { getHistoryPayload, getInventoryPayload, getProfilesPayload } from "./device-manager-service-data.mjs";
import { getJobArtifactsPayload, getJobLogPayload, getJobReportPayload, getJobsPayload } from "./stage3-job-service-data.mjs";

function parseServiceArgs(argv) {
  const result = {
    host: "127.0.0.1",
    port: 8787,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--host") {
      result.host = next ?? result.host;
      index += 1;
    } else if (token === "--port") {
      result.port = Number.parseInt(next ?? String(result.port), 10);
      index += 1;
    }
  }

  return result;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function handleQuery(requestUrl, response) {
  const args = parseQueryArgs([]);
  args.view = requestUrl.searchParams.get("view") ?? args.view;
  args.format = "json";
  args.limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? String(args.limit), 10);
  args.presentOnly = ["1", "true", "yes"].includes(String(requestUrl.searchParams.get("presentOnly") ?? "").toLowerCase());
  args.family = requestUrl.searchParams.get("family");
  args.unit = requestUrl.searchParams.get("unit");

  const payload = await runQuery(args);
  sendJson(response, 200, payload);
}

async function handleInventory(requestUrl, response) {
  sendJson(response, 200, await getInventoryPayload(requestUrl.searchParams));
}

async function handleHistory(requestUrl, response) {
  sendJson(response, 200, await getHistoryPayload(requestUrl.searchParams));
}

async function handleProfiles(requestUrl, response) {
  sendJson(response, 200, await getProfilesPayload(requestUrl.searchParams));
}

async function handleJobs(requestUrl, response) {
  sendJson(response, 200, await getJobsPayload(requestUrl.searchParams));
}

async function handleJobLog(requestUrl, response) {
  sendJson(response, 200, await getJobLogPayload(requestUrl.searchParams));
}

async function handleJobReport(requestUrl, response) {
  sendJson(response, 200, await getJobReportPayload(requestUrl.searchParams));
}

async function handleJobArtifacts(requestUrl, response) {
  sendJson(response, 200, await getJobArtifactsPayload(requestUrl.searchParams));
}

async function main() {
  const args = parseServiceArgs(process.argv.slice(2));

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? `${args.host}:${args.port}`}`);
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed" });
        return;
      }

      if (requestUrl.pathname === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (requestUrl.pathname === "/api/query") {
        await handleQuery(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/inventory") {
        await handleInventory(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/history") {
        await handleHistory(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/profiles") {
        await handleProfiles(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/jobs") {
        await handleJobs(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/job-log") {
        await handleJobLog(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/job-report") {
        await handleJobReport(requestUrl, response);
        return;
      }

      if (requestUrl.pathname === "/api/job-artifacts") {
        await handleJobArtifacts(requestUrl, response);
        return;
      }

      sendJson(response, 404, {
        error: "not_found",
        endpoints: [
          "/health",
          "/api/query?view=units",
          "/api/query?view=families",
          "/api/query?view=changes",
          "/api/query?view=diff",
          "/api/query?view=conflicts",
          "/api/inventory",
          "/api/history",
          "/api/profiles",
          "/api/jobs",
          "/api/job-log?job=job-000001",
          "/api/job-report?job=job-000001",
          "/api/job-artifacts?job=job-000001"
        ],
      });
    } catch (error) {
      sendJson(response, 500, { error: "internal_error", message: error.message || String(error) });
    }
  });

  server.listen(args.port, args.host, () => {
    console.log(`Board Manager query service listening on http://${args.host}:${args.port}`);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
