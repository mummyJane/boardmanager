const state = {
  currentView: "inventory",
  tree: null,
  modules: null,
  boards: null,
  projects: null,
};

const titles = {
  inventory: {
    title: "Inventory",
    eyebrow: "Bench overview",
    description: "Inventory, jobs, and reports are the next UI slices. This first shell gives them fixed navigation positions now so the layout can settle before deeper workflows land."
  },
  modules: {
    title: "Modules",
    eyebrow: "Catalog",
    description: "Reusable modules and device catalog entries from the current Stage 4 tree model."
  },
  boards: {
    title: "Boards",
    eyebrow: "Assemblies",
    description: "Board assemblies with controller, buses, signals, connectors, and linked help references."
  },
  projects: {
    title: "Projects",
    eyebrow: "Targets",
    description: "Deployable board-targeted projects with app roots, OTA policy, and stable firmware API boundaries."
  },
  jobs: {
    title: "Jobs",
    eyebrow: "Execution",
    description: "Stage 3 job pages are the next task family after the shell. This slot is reserved for build, program, run, debug, and validation activity."
  },
  reports: {
    title: "Reports",
    eyebrow: "Validation & logs",
    description: "Validation reports, run logs, and later exported operator reports will surface here once the shell grows beyond the first frame."
  }
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`);
  }
  return response.json();
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function renderList(items) {
  if (!items.length) {
    return `<div class="empty-note">No items to show yet.</div>`;
  }

  return `<ul class="data-list">${items.map((item) => `
    <li class="data-card">
      <h4>${item.title}</h4>
      <div>${item.description ?? ""}</div>
      ${item.meta?.length ? `<div class="meta-row">${item.meta.map((entry) => `<span class="meta-chip">${entry}</span>`).join("")}</div>` : ""}
    </li>
  `).join("")}</ul>`;
}

function renderPreview(view) {
  const secondaryTitle = document.getElementById("secondary-title");
  const secondaryBody = document.getElementById("secondary-body");
  secondaryTitle.textContent = `${titles[view].title} Preview`;

  if (view === "modules" && state.modules) {
    const sample = state.modules.nodes.slice(0, 4).map((node) => ({
      title: node.title,
      description: `${node.metadata.catalogRole} from ${node.metadata.vendor ?? "unknown vendor"}`,
      meta: [node.metadata.partType ?? "unknown", node.metadata.moduleId ?? node.nodeId]
    }));
    secondaryBody.innerHTML = renderList(sample);
    return;
  }

  if (view === "boards" && state.boards) {
    const sample = state.boards.nodes.slice(0, 4).map((node) => ({
      title: node.title,
      description: `Controller ${node.metadata.controllerModuleId ?? "unknown"}`,
      meta: [node.metadata.boardId ?? node.nodeId, `${(node.metadata.projectIds ?? []).length} projects`]
    }));
    secondaryBody.innerHTML = renderList(sample);
    return;
  }

  if (view === "projects" && state.projects) {
    const sample = state.projects.nodes.slice(0, 4).map((node) => ({
      title: node.title,
      description: `Targets ${node.metadata.boardId ?? "unknown board"}`,
      meta: [node.metadata.firmwareFamily ?? "unknown", node.metadata.appId ?? "no appId"]
    }));
    secondaryBody.innerHTML = renderList(sample);
    return;
  }

  secondaryBody.innerHTML = `<div class="empty-note">${titles[view].description}</div>`;
}

function renderPrimary(view) {
  const titleInfo = titles[view];
  setText("view-title", titleInfo.title);
  setText("primary-eyebrow", titleInfo.eyebrow);
  setText("primary-title", titleInfo.title);

  const primaryBody = document.getElementById("primary-body");

  if (view === "inventory") {
    primaryBody.innerHTML = `
      <div class="empty-note">
        <strong>Inventory shell is reserved.</strong><br>
        The shell navigation is in place now. The next inventory task will fill this panel from Stage 2 unit history, conflicts, overrides, and recent Stage 3 jobs.
      </div>`;
    return;
  }

  if (view === "modules" && state.modules) {
    const items = state.modules.nodes.map((node) => ({
      title: node.title,
      description: `${node.metadata.catalogRole} entry with ${node.children?.length ?? 0} linked references`,
      meta: [node.metadata.vendor ?? "unknown vendor", node.metadata.moduleId ?? node.nodeId]
    }));
    primaryBody.innerHTML = renderList(items);
    return;
  }

  if (view === "boards" && state.boards) {
    const items = state.boards.nodes.map((node) => ({
      title: node.title,
      description: `Capabilities: ${(node.metadata.capabilityKeys ?? []).join(", ") || "none declared"}`,
      meta: [node.metadata.boardId ?? node.nodeId, node.metadata.revision ?? "unknown rev"]
    }));
    primaryBody.innerHTML = renderList(items);
    return;
  }

  if (view === "projects" && state.projects) {
    const items = state.projects.nodes.map((node) => ({
      title: node.title,
      description: `App root: ${node.metadata.appRoot ?? "n/a"}`,
      meta: [node.metadata.boardId ?? "unknown board", node.metadata.firmwareFamily ?? "unknown family"]
    }));
    primaryBody.innerHTML = renderList(items);
    return;
  }

  primaryBody.innerHTML = `<div class="empty-note">${titleInfo.description}</div>`;
}

function setActiveView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });
  renderPrimary(view);
  renderPreview(view);
}

async function loadShell() {
  const [health, tree, modules, boards, projects] = await Promise.all([
    fetchJson('/health'),
    fetchJson('/api/stage4/tree'),
    fetchJson('/api/stage4/modules?includeChildren=false'),
    fetchJson('/api/stage4/boards?includeChildren=false'),
    fetchJson('/api/stage4/projects?includeChildren=false')
  ]);

  state.tree = tree;
  state.modules = modules;
  state.boards = boards;
  state.projects = projects;

  setText('api-runtime', `runtime: ${health.runtime}`);
  setText('model-stamp', `tree: ${tree.generatedAt}`);
  setText('root-count', String(tree.roots.length));
  setText('module-count', String(tree.summary.moduleCount));
  setText('board-count', String(tree.summary.boardCount));
  setText('project-count', String(tree.summary.projectCount));

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });

  setActiveView(state.currentView);
}

loadShell().catch((error) => {
  setText('api-runtime', 'runtime: error');
  setText('model-stamp', 'tree: unavailable');
  document.getElementById('primary-title').textContent = 'Shell failed to load';
  document.getElementById('primary-body').innerHTML = `<div class="empty-note">${error.message}</div>`;
});