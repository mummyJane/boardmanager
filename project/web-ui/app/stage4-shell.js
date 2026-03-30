const state = {
  currentView: "inventory",
  tree: null,
  modules: null,
  boards: null,
  projects: null,
  inventoryDashboard: null,
  moduleCatalog: null,
  selectedModuleId: null,
  moduleHelp: null,
};

const titles = {
  inventory: {
    title: "Inventory",
    eyebrow: "Bench overview",
    description: "Current bench units, conflicts, recent validation state, and recent Stage 3 activity."
  },
  modules: {
    title: "Modules",
    eyebrow: "Catalog",
    description: "Reusable modules and device catalog entries with vendor, help, and composition coverage from the Stage 4 catalog endpoint."
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function inventoryStatusLabel(unit) {
  if (!unit.health) {
    return 'no report';
  }
  return unit.health.overallPass ? 'pass' : `fail (${unit.health.failingCheckCount ?? 0})`;
}

function markdownToHtml(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (!listItems.length) {
      return;
    }
    blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    listItems = [];
  }

  function formatInline(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      blocks.push(`<h4>${formatInline(line.slice(2))}</h4>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push(`<h5>${formatInline(line.slice(3))}</h5>`);
      continue;
    }
    if (line.startsWith('- ')) {
      listItems.push(formatInline(line.slice(2)));
      continue;
    }
    flushList();
    blocks.push(`<p>${formatInline(line)}</p>`);
  }

  flushList();
  return blocks.join('');
}

function renderModuleCard(module) {
  const selected = state.selectedModuleId === module.moduleId;
  return `
    <li class="data-card selectable-card${selected ? ' is-selected' : ''}">
      <button class="card-button" data-module-id="${module.moduleId}" type="button">
        <h4>${module.title}</h4>
        <div>${module.catalogRole} · ${module.helpReferenceCount} help refs · ${module.interfaceCount} interfaces</div>
        <div class="meta-row">
          <span class="meta-chip">${module.vendor}</span>
          <span class="meta-chip">${module.moduleId}</span>
          <span class="meta-chip">${module.partType ?? 'unknown'}</span>
          <span class="meta-chip">${module.supportsComposition ? 'composed-capable' : 'leaf-only'}</span>
        </div>
      </button>
    </li>`;
}

function renderModuleHelpPanel() {
  if (!state.moduleHelp) {
    return `<div class="empty-note">Select a module to load help content.</div>`;
  }

  const detail = state.moduleHelp;
  const refs = detail.references ?? [];
  const docs = detail.documents ?? [];
  const api = detail.module.api ?? [];
  const configEntries = Object.entries(detail.module.defaultConfig ?? {});

  return `
    <div class="detail-stack">
      <div>
        <div class="eyebrow">Selected module</div>
        <h4>${detail.module.title}</h4>
        <div class="meta-row">
          <span class="meta-chip">${detail.module.vendor}</span>
          <span class="meta-chip">${detail.module.moduleId}</span>
          <span class="meta-chip">${detail.module.catalogRole}</span>
          <span class="meta-chip">${detail.module.partType ?? 'unknown'}</span>
        </div>
      </div>
      <div>
        <strong>Interfaces</strong>
        <div class="meta-row">${(detail.module.interfaces.length ? detail.module.interfaces : ['none']).map((entry) => `<span class="meta-chip">${entry}</span>`).join('')}</div>
      </div>
      <div>
        <strong>Default config</strong>
        ${configEntries.length ? `<div class="meta-row">${configEntries.map(([key, value]) => `<span class="meta-chip">${key} ${value}</span>`).join('')}</div>` : '<div class="empty-inline">No default config declared.</div>'}
      </div>
      <div>
        <strong>High-level API</strong>
        ${api.length ? `<ul class="inline-list">${api.map((entry) => `<li><code>${escapeHtml(entry.name)}</code>: ${escapeHtml(entry.description ?? '')}</li>`).join('')}</ul>` : '<div class="empty-inline">No high-level API entries declared.</div>'}
      </div>
      <div>
        <strong>References</strong>
        ${refs.length ? `<ul class="inline-list">${refs.map((ref) => `<li>${escapeHtml(ref.title)}: ${ref.href ? `<a href="${ref.href}" target="_blank" rel="noreferrer">open</a>` : `<code>${escapeHtml(ref.path ?? 'local')}</code>`}</li>`).join('')}</ul>` : '<div class="empty-inline">No linked references.</div>'}
      </div>
      <div>
        <strong>Help content</strong>
        ${docs.length ? docs.map((doc) => `<article class="help-doc"><div class="eyebrow">${escapeHtml(doc.title ?? doc.kind ?? 'document')}</div>${markdownToHtml(doc.markdown)}</article>`).join('') : '<div class="empty-inline">No local help document linked for this module.</div>'}
      </div>
    </div>`;
}

async function selectModule(moduleId) {
  state.selectedModuleId = moduleId;
  renderPrimary('modules');
  const helpPayload = await fetchJson(`/api/stage4/module-help/${encodeURIComponent(moduleId)}`);
  if (state.selectedModuleId !== moduleId) {
    return;
  }
  state.moduleHelp = helpPayload;
  renderPreview('modules');
}

function renderPreview(view) {
  const secondaryTitle = document.getElementById("secondary-title");
  const secondaryBody = document.getElementById("secondary-body");
  secondaryTitle.textContent = `${titles[view].title} Preview`;

  if (view === "inventory" && state.inventoryDashboard) {
    const previewItems = [
      {
        title: 'Conflicts',
        description: `${state.inventoryDashboard.summary.conflictCount} unresolved identity conflicts on the current bench.`,
        meta: [`overrides ${state.inventoryDashboard.summary.overrideCount}`, `reports ${state.inventoryDashboard.summary.recentReportCount}`]
      },
      {
        title: 'Recent validation',
        description: `${state.inventoryDashboard.summary.failingRecentReportCount} of the recent validation reports are failing.`,
        meta: [`healthy units ${state.inventoryDashboard.summary.healthyUnitCount}`, `jobs ${state.inventoryDashboard.summary.recentJobCount}`]
      }
    ];

    if (state.inventoryDashboard.conflicts.length) {
      previewItems.push(...state.inventoryDashboard.conflicts.map((conflict) => ({
        title: conflict.conflictId ?? 'conflict',
        description: `Chosen ${conflict.chosenStableKey ?? 'unknown'} over ${conflict.candidateStableKeys.join(', ')}`,
        meta: [conflict.status ?? 'unknown', conflict.detectedAt ?? '']
      })));
    } else {
      previewItems.push({
        title: 'No active conflicts',
        description: 'The current bench inventory has no unresolved identity conflicts.',
        meta: []
      });
    }

    secondaryBody.innerHTML = renderList(previewItems);
    return;
  }

  if (view === "modules" && state.moduleCatalog) {
    secondaryTitle.textContent = state.moduleHelp ? `${state.moduleHelp.module.title} Help` : `${titles[view].title} Preview`;
    secondaryBody.innerHTML = renderModuleHelpPanel();
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

  if (view === "inventory" && state.inventoryDashboard) {
    const items = state.inventoryDashboard.units.map((unit) => ({
      title: unit.label || unit.boardId || unit.unitId,
      description: `${unit.port ?? 'no port'} · ${unit.boardMatchStatus ?? 'unmatched'} · ${unit.firmwareApp ?? 'no firmware id'}`,
      meta: [
        unit.unitId,
        unit.transportKind ?? 'unknown transport',
        unit.chip ?? 'unknown chip',
        inventoryStatusLabel(unit)
      ]
    }));
    primaryBody.innerHTML = renderList(items);
    return;
  }

  if (view === "modules" && state.moduleCatalog) {
    primaryBody.innerHTML = `<ul class="data-list">${state.moduleCatalog.modules.map(renderModuleCard).join('')}</ul>`;
    document.querySelectorAll('[data-module-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectModule(button.dataset.moduleId).catch((error) => {
          document.getElementById('secondary-body').innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
        });
      });
    });
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
  const [health, tree, modules, boards, projects, inventoryDashboard, moduleCatalog] = await Promise.all([
    fetchJson('/health'),
    fetchJson('/api/stage4/tree'),
    fetchJson('/api/stage4/modules?includeChildren=false'),
    fetchJson('/api/stage4/boards?includeChildren=false'),
    fetchJson('/api/stage4/projects?includeChildren=false'),
    fetchJson('/api/stage4/dashboard/inventory'),
    fetchJson('/api/stage4/dashboard/modules')
  ]);

  state.tree = tree;
  state.modules = modules;
  state.boards = boards;
  state.projects = projects;
  state.inventoryDashboard = inventoryDashboard;
  state.moduleCatalog = moduleCatalog;
  state.selectedModuleId = moduleCatalog.modules[0]?.moduleId ?? null;

  setText('api-runtime', `runtime: ${health.runtime}`);
  setText('model-stamp', `tree: ${tree.generatedAt}`);
  setText('root-count', String(tree.roots.length));
  setText('module-count', String(tree.summary.moduleCount));
  setText('board-count', String(tree.summary.boardCount));
  setText('project-count', String(tree.summary.projectCount));

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });

  if (state.selectedModuleId) {
    state.moduleHelp = await fetchJson(`/api/stage4/module-help/${encodeURIComponent(state.selectedModuleId)}`);
  }

  setActiveView(state.currentView);
}

loadShell().catch((error) => {
  setText('api-runtime', 'runtime: error');
  setText('model-stamp', 'tree: unavailable');
  document.getElementById('primary-title').textContent = 'Shell failed to load';
  document.getElementById('primary-body').innerHTML = `<div class="empty-note">${error.message}</div>`;
});
