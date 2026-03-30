import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const webUiRoot = path.join(projectRoot, "web-ui");
const modelPath = path.join(webUiRoot, "data", "stage4-tree-model.json");
const modulesRoot = path.join(projectRoot, "parts", "modules");
const devicesRoot = path.join(projectRoot, "parts", "devices");
const boardsRoot = path.join(projectRoot, "boards");
const projectsRoot = path.join(projectRoot, "projects");

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function countJsonFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).length;
}

function ensure(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

function validateNode(node, errors, seenIds) {
  ensure(node && typeof node === "object" && !Array.isArray(node), "tree node must be an object", errors);
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return;
  }

  ensure(typeof node.nodeId === "string" && node.nodeId.length > 0, "tree node missing nodeId", errors);
  ensure(typeof node.nodeKind === "string" && node.nodeKind.length > 0, `node '${node.nodeId ?? "unknown"}' missing nodeKind`, errors);
  ensure(typeof node.title === "string" && node.title.length > 0, `node '${node.nodeId ?? "unknown"}' missing title`, errors);
  ensure(node.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata), `node '${node.nodeId ?? "unknown"}' missing metadata object`, errors);
  ensure(Array.isArray(node.children), `node '${node.nodeId ?? "unknown"}' missing children array`, errors);

  if (typeof node.nodeId === "string") {
    if (seenIds.has(node.nodeId)) {
      errors.push(`duplicate nodeId '${node.nodeId}'`);
    }
    seenIds.add(node.nodeId);
  }

  for (const child of node.children ?? []) {
    validateNode(child, errors, seenIds);
  }
}

async function main() {
  const [model, moduleFileCount, deviceFileCount, boardFileCount, projectFileCount] = await Promise.all([
    loadJson(modelPath),
    countJsonFiles(modulesRoot),
    countJsonFiles(devicesRoot),
    countJsonFiles(boardsRoot),
    countJsonFiles(projectsRoot),
  ]);

  const errors = [];
  ensure(model.schemaVersion === "1.0", "stage4-tree-model.json must have schemaVersion '1.0'", errors);
  ensure(model.preferredWebRuntime === "python", "stage4-tree-model.json must declare preferredWebRuntime 'python'", errors);
  ensure(Array.isArray(model.roots), "stage4-tree-model.json missing roots array", errors);

  const seenIds = new Set();
  for (const root of model.roots ?? []) {
    validateNode(root, errors, seenIds);
  }

  const rootById = new Map((model.roots ?? []).map((root) => [root.nodeId, root]));
  const modulesRootNode = rootById.get("modules-root");
  const boardsRootNode = rootById.get("boards-root");
  const projectsRootNode = rootById.get("projects-root");

  ensure(Boolean(modulesRootNode), "missing modules-root node", errors);
  ensure(Boolean(boardsRootNode), "missing boards-root node", errors);
  ensure(Boolean(projectsRootNode), "missing projects-root node", errors);

  if (modulesRootNode) {
    ensure(modulesRootNode.children.length === moduleFileCount + deviceFileCount, `modules-root expected ${moduleFileCount + deviceFileCount} children, found ${modulesRootNode.children.length}`, errors);
  }
  if (boardsRootNode) {
    ensure(boardsRootNode.children.length === boardFileCount, `boards-root expected ${boardFileCount} children, found ${boardsRootNode.children.length}`, errors);
  }
  if (projectsRootNode) {
    ensure(projectsRootNode.children.length === projectFileCount, `projects-root expected ${projectFileCount} children, found ${projectsRootNode.children.length}`, errors);
  }

  ensure(model.summary?.moduleCount === moduleFileCount + deviceFileCount, "summary.moduleCount does not match source files", errors);
  ensure(model.summary?.boardCount === boardFileCount, "summary.boardCount does not match source files", errors);
  ensure(model.summary?.projectCount === projectFileCount, "summary.projectCount does not match source files", errors);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Validation error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated Stage 4 tree model: ${model.summary.moduleCount} modules, ${model.summary.boardCount} boards, and ${model.summary.projectCount} projects.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});