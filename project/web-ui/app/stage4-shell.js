const state = {
  currentView: "inventory",
  tree: null,
  modules: null,
  boards: null,
  projects: null,
  inventoryDashboard: null,
  moduleCatalog: null,
  boardCatalog: null,
  selectedModuleId: null,
  selectedBoardId: null,
  moduleHelp: null,
  boardDetail: null,
  moduleCreateMode: false,
  moduleComposeMode: false,
  moduleCreateStatus: null,
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
    description: "Reusable modules and device catalog entries with vendor, help, composition coverage, and user-defined leaf or composed-module creation."
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

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `${url} -> ${response.status}`);
  }
  return data;
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

function renderBoardCard(board) {
  const selected = state.selectedBoardId === board.boardId;
  return `
    <li class="data-card selectable-card${selected ? ' is-selected' : ''}">
      <button class="card-button" data-board-id="${board.boardId}" type="button">
        <h4>${board.title}</h4>
        <div>${board.controllerModuleId ?? 'no controller'} · ${board.busCount} buses · ${board.signalCount} signals</div>
        <div class="meta-row">
          <span class="meta-chip">${board.boardId}</span>
          <span class="meta-chip">${board.revision ?? 'unknown rev'}</span>
          <span class="meta-chip">${board.connectorCount} connectors</span>
          <span class="meta-chip">${board.projectIds.length} projects</span>
        </div>
      </button>
    </li>`;
}

function renderBoardDetailPanel() {
  if (!state.boardDetail) {
    return `<div class="empty-note">Select a board to inspect its assembly, buses, signals, and boot order.</div>`;
  }

  const detail = state.boardDetail;
  const board = detail.board;
  const refs = detail.references ?? [];
  const docs = detail.documents ?? [];
  const moduleInstances = detail.moduleInstances ?? [];
  const buses = detail.buses ?? [];
  const signals = detail.signals ?? [];
  const connectors = detail.connectors ?? [];
  const bootSequence = detail.bootSequence ?? [];
  const artifacts = board.generatedArtifacts ?? [];

  return `
    <div class="detail-stack">
      <div>
        <div class="eyebrow">Selected board</div>
        <h4>${board.title}</h4>
        <div class="meta-row">
          <span class="meta-chip">${board.boardId}</span>
          <span class="meta-chip">${board.revision ?? 'unknown rev'}</span>
          <span class="meta-chip">${board.controllerModuleId ?? 'no controller'}</span>
        </div>
      </div>
      <div>
        <strong>Module instances</strong>
        ${moduleInstances.length ? `<ul class="inline-list">${moduleInstances.map((entry) => `<li><code>${escapeHtml(entry.instanceId || 'unknown')}</code> -> <code>${escapeHtml(entry.moduleId || 'unknown')}</code>${entry.busName ? ` on ${escapeHtml(entry.busName)}` : ''}</li>`).join('')}</ul>` : '<div class="empty-inline">No module instances declared.</div>'}
      </div>
      <div>
        <strong>Buses</strong>
        ${buses.length ? `<ul class="inline-list">${buses.map((bus) => `<li><code>${escapeHtml(bus.name || 'unknown')}</code>: ${escapeHtml(bus.kind || 'unknown')} via ${escapeHtml(bus.controllerPeripheral || 'unknown')}</li>`).join('')}</ul>` : '<div class="empty-inline">No buses declared.</div>'}
      </div>
      <div>
        <strong>Signals</strong>
        ${signals.length ? `<ul class="inline-list">${signals.map((signal) => `<li><code>${escapeHtml(signal.name || 'unknown')}</code>: ${escapeHtml(signal.kind || 'unknown')}</li>`).join('')}</ul>` : '<div class="empty-inline">No signals declared.</div>'}
      </div>
      <div>
        <strong>Connectors</strong>
        ${connectors.length ? `<ul class="inline-list">${connectors.map((connector) => `<li><code>${escapeHtml(connector.name || 'unknown')}</code>: ${(connector.pins || []).length} pins</li>`).join('')}</ul>` : '<div class="empty-inline">No connectors declared.</div>'}
      </div>
      <div>
        <strong>Boot order</strong>
        ${bootSequence.length ? `<ol class="inline-list">${bootSequence.map((step) => `<li><code>${escapeHtml(step.kind || 'unknown')}</code>${step.bus ? ` ${escapeHtml(step.bus)}` : ''}${step.instanceId ? ` ${escapeHtml(step.instanceId)}` : ''}${step.signal ? ` ${escapeHtml(step.signal)}` : ''}</li>`).join('')}</ol>` : '<div class="empty-inline">No boot sequence declared.</div>'}
      </div>
      <div>
        <strong>Generated API artifacts</strong>
        ${artifacts.length ? `<ul class="inline-list">${artifacts.map((entry) => `<li><code>${escapeHtml(entry)}</code></li>`).join('')}</ul>` : '<div class="empty-inline">No generated board artifacts found.</div>'}
      </div>
      <div>
        <strong>References</strong>
        ${refs.length ? `<ul class="inline-list">${refs.map((ref) => `<li>${escapeHtml(ref.title)}: ${ref.href ? `<a href="${ref.href}" target="_blank" rel="noreferrer">open</a>` : `<code>${escapeHtml(ref.path ?? 'local')}</code>`}</li>`).join('')}</ul>` : '<div class="empty-inline">No linked references.</div>'}
      </div>
      <div>
        <strong>Help content</strong>
        ${docs.length ? docs.map((doc) => `<article class="help-doc"><div class="eyebrow">${escapeHtml(doc.title ?? doc.kind ?? 'document')}</div>${markdownToHtml(doc.markdown)}</article>`).join('') : '<div class="empty-inline">No local help document linked for this board.</div>'}
      </div>
    </div>`;
}

function renderModuleToolbar() {
  return `
    <div class="action-row">
      <button class="action-button" type="button" id="module-create-toggle">${state.moduleCreateMode ? 'Back to help' : 'New leaf module'}</button>
      <button class="action-button" type="button" id="module-compose-toggle">${state.moduleComposeMode ? 'Back to help' : 'New composed module'}</button>
      ${state.selectedModuleId ? `<span class="status-chip">selected ${escapeHtml(state.selectedModuleId)}</span>` : ''}
    </div>`;
}

function renderModuleStatus() {
  if (!state.moduleCreateStatus) {
    return '';
  }
  return `<div class="status-banner ${state.moduleCreateStatus.kind}">${escapeHtml(state.moduleCreateStatus.message)}</div>`;
}

function renderModuleCreatePanel() {
  return `
    <form id="module-create-form" class="form-stack">
      <div class="eyebrow">Create module</div>
      <div class="form-grid">
        <label class="field-label">Module id
          <input class="text-input" name="moduleId" placeholder="user_temp_sensor" required pattern="[a-z][a-z0-9_]*">
        </label>
        <label class="field-label">Display name
          <input class="text-input" name="displayName" placeholder="User Temp Sensor" required>
        </label>
        <label class="field-label">Vendor
          <input class="text-input" name="vendor" placeholder="User or vendor" required>
        </label>
        <label class="field-label">Interfaces
          <input class="text-input" name="interfaces" placeholder="i2c, interrupt">
        </label>
        <label class="field-label">I2C address
          <input class="text-input" name="i2cAddress" placeholder="0x48">
        </label>
        <label class="field-label">Website
          <input class="text-input" name="website" placeholder="https://example.com/module">
        </label>
        <label class="field-label">Datasheet
          <input class="text-input" name="datasheet" placeholder="https://example.com/module.pdf">
        </label>
      </div>
      <label class="field-label">High-level API entries
        <textarea class="text-area" name="apiEntries" rows="4" placeholder="read_value|Read the current sensor value
configure_rate|Apply a sampling rate"></textarea>
      </label>
      <label class="field-label">Help markdown
        <textarea class="text-area" name="helpMarkdown" rows="10" placeholder="# Module name

## Summary

Describe the module and any usage notes."></textarea>
      </label>
      <div class="action-row">
        <button class="action-button primary" type="submit">Create module</button>
        <span class="empty-inline">This creates a user-defined leaf device under the existing parts catalog.</span>
      </div>
    </form>`;
}

function renderModuleComposePanel() {
  return `
    <form id="module-compose-form" class="form-stack">
      <div class="eyebrow">Compose module</div>
      <div class="form-grid">
        <label class="field-label">Module id
          <input class="text-input" name="moduleId" placeholder="user_gnss_stack" required pattern="[a-z][a-z0-9_]*">
        </label>
        <label class="field-label">Display name
          <input class="text-input" name="displayName" placeholder="User GNSS Stack" required>
        </label>
        <label class="field-label">Vendor
          <input class="text-input" name="vendor" placeholder="User or vendor" required>
        </label>
        <label class="field-label">Interfaces
          <input class="text-input" name="interfaces" placeholder="uart, i2c, pps">
        </label>
        <label class="field-label">Default config
          <textarea class="text-area" name="defaultConfig" rows="4" placeholder="baud=9600
scanWindowMs=250"></textarea>
        </label>
        <label class="field-label">Website
          <input class="text-input" name="website" placeholder="https://example.com/module">
        </label>
        <label class="field-label">Datasheet
          <input class="text-input" name="datasheet" placeholder="https://example.com/module.pdf">
        </label>
      </div>
      <label class="field-label">Child modules
        <textarea class="text-area" name="compositionChildren" rows="6" placeholder="neo_m9n|gnssReceiver|NEO-M9N
bm8563|rtc|BM8563 RTC"></textarea>
      </label>
      <label class="field-label">High-level API entries
        <textarea class="text-area" name="apiEntries" rows="4" placeholder="get_fix|Return the composed module fix state
read_health|Return composed submodule health"></textarea>
      </label>
      <label class="field-label">Help markdown
        <textarea class="text-area" name="helpMarkdown" rows="10" placeholder="# Module name

## Summary

Describe the composed module and child relationships."></textarea>
      </label>
      <div class="action-row">
        <button class="action-button primary" type="submit">Create composed module</button>
        <span class="empty-inline">Child rows use <code>moduleId|role|display name</code>.</span>
      </div>
    </form>`;
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
  const compositionChildren = detail.module.compositionChildren ?? [];

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
        <strong>Child modules</strong>
        ${compositionChildren.length ? `<ul class="inline-list">${compositionChildren.map((child) => `<li><code>${escapeHtml(child.partId || child.moduleId || 'unknown')}</code>${child.role ? `: ${escapeHtml(child.role)}` : ''}</li>`).join('')}</ul>` : '<div class="empty-inline">No child modules declared.</div>'}
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

function parseCompositionChildren(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [partId, role, displayName] = line.split('|').map((entry) => entry.trim());
      return {
        partId,
        moduleId: partId,
        role: role || null,
        displayName: displayName || partId,
        config: {},
      };
    })
    .filter((entry) => entry.partId);
}

function parseApiEntries(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split('|');
      return {
        name: (name || '').trim(),
        description: rest.join('|').trim(),
      };
    })
    .filter((entry) => entry.name);
}

function parseScalarConfig(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((config, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return config;
      }
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      if (!key) {
        return config;
      }
      config[key] = rawValue;
      return config;
    }, {});
}

async function selectModule(moduleId) {
  state.selectedModuleId = moduleId;
  state.moduleCreateMode = false;
  state.moduleComposeMode = false;
  renderPrimary('modules');
  const helpPayload = await fetchJson(`/api/stage4/module-help/${encodeURIComponent(moduleId)}`);
  if (state.selectedModuleId !== moduleId) {
    return;
  }
  state.moduleHelp = helpPayload;
  renderPreview('modules');
}

async function selectBoard(boardId) {
  state.selectedBoardId = boardId;
  renderPrimary('boards');
  const detailPayload = await fetchJson(`/api/stage4/board-detail/${encodeURIComponent(boardId)}`);
  if (state.selectedBoardId !== boardId) {
    return;
  }
  state.boardDetail = detailPayload;
  renderPreview('boards');
}

async function handleModuleComposeSubmit(form) {
  const formData = new FormData(form);
  const payload = {
    moduleId: String(formData.get('moduleId') || '').trim(),
    displayName: String(formData.get('displayName') || '').trim(),
    vendor: String(formData.get('vendor') || '').trim(),
    interfaces: String(formData.get('interfaces') || '').split(',').map((entry) => entry.trim()).filter(Boolean),
    defaultConfig: parseScalarConfig(formData.get('defaultConfig')),
    docs: {
      website: String(formData.get('website') || '').trim() || null,
      datasheet: String(formData.get('datasheet') || '').trim() || null,
    },
    api: parseApiEntries(formData.get('apiEntries')),
    compositionChildren: parseCompositionChildren(formData.get('compositionChildren')),
    helpMarkdown: String(formData.get('helpMarkdown') || '').trim(),
  };

  const validation = await postJson('/api/stage4/module-validate', payload);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const result = await postJson('/api/stage4/module-compose', payload);
  const warningText = (validation.warnings ?? []).length ? ` Warnings: ${(validation.warnings || []).join(' | ')}` : '';
  state.moduleCreateStatus = { kind: 'success', message: `Created ${result.created.moduleId}.${warningText}` };
  state.moduleComposeMode = false;
  await loadShell(result.created.moduleId);
  renderPreview('modules');
}

async function handleModuleCreateSubmit(form) {
  const formData = new FormData(form);
  const payload = {
    moduleId: String(formData.get('moduleId') || '').trim(),
    displayName: String(formData.get('displayName') || '').trim(),
    vendor: String(formData.get('vendor') || '').trim(),
    interfaces: String(formData.get('interfaces') || '').split(',').map((entry) => entry.trim()).filter(Boolean),
    defaultConfig: {},
    docs: {
      website: String(formData.get('website') || '').trim() || null,
      datasheet: String(formData.get('datasheet') || '').trim() || null,
    },
    api: parseApiEntries(formData.get('apiEntries')),
    helpMarkdown: String(formData.get('helpMarkdown') || '').trim(),
  };
  const i2cAddress = String(formData.get('i2cAddress') || '').trim();
  if (i2cAddress) {
    payload.defaultConfig.i2cAddress = i2cAddress;
  }

  const validation = await postJson('/api/stage4/module-validate', payload);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const result = await postJson('/api/stage4/module-create', payload);
  const warningText = (validation.warnings ?? []).length ? ` Warnings: ${(validation.warnings || []).join(' | ')}` : '';
  state.moduleCreateStatus = { kind: 'success', message: `Created ${result.created.moduleId}.${warningText}` };
  state.moduleCreateMode = false;
  state.moduleComposeMode = false;
  await loadShell(result.created.moduleId);
  renderPreview('modules');
}

function bindModulePreviewActions() {
  document.getElementById('module-create-toggle')?.addEventListener('click', () => {
    state.moduleCreateMode = !state.moduleCreateMode;
    state.moduleComposeMode = false;
    state.moduleCreateStatus = null;
    renderPreview('modules');
  });

  document.getElementById('module-compose-toggle')?.addEventListener('click', () => {
    state.moduleComposeMode = !state.moduleComposeMode;
    state.moduleCreateMode = false;
    state.moduleCreateStatus = null;
    renderPreview('modules');
  });

  const createForm = document.getElementById('module-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        state.moduleCreateStatus = { kind: 'info', message: 'Creating module...' };
        renderPreview('modules');
        await handleModuleCreateSubmit(createForm);
      } catch (error) {
        state.moduleCreateStatus = { kind: 'error', message: error.message };
        state.moduleCreateMode = true;
        renderPreview('modules');
      }
    });
  }

  const composeForm = document.getElementById('module-compose-form');
  if (composeForm) {
    composeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        state.moduleCreateStatus = { kind: 'info', message: 'Creating composed module...' };
        renderPreview('modules');
        await handleModuleComposeSubmit(composeForm);
      } catch (error) {
        state.moduleCreateStatus = { kind: 'error', message: error.message };
        state.moduleComposeMode = true;
        renderPreview('modules');
      }
    });
  }
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
    secondaryTitle.textContent = state.moduleCreateMode
      ? 'Create module'
      : state.moduleComposeMode
        ? 'Compose module'
        : (state.moduleHelp ? `${state.moduleHelp.module.title} Help` : `${titles[view].title} Preview`);
    secondaryBody.innerHTML = `${renderModuleToolbar()}${renderModuleStatus()}${state.moduleCreateMode ? renderModuleCreatePanel() : state.moduleComposeMode ? renderModuleComposePanel() : renderModuleHelpPanel()}`;
    bindModulePreviewActions();
    return;
  }

  if (view === "boards" && state.boardCatalog) {
    secondaryTitle.textContent = state.boardDetail ? `${state.boardDetail.board.title} Detail` : `${titles[view].title} Preview`;
    secondaryBody.innerHTML = renderBoardDetailPanel();
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

  if (view === "boards" && state.boardCatalog) {
    primaryBody.innerHTML = `<ul class="data-list">${state.boardCatalog.boards.map(renderBoardCard).join('')}</ul>`;
    document.querySelectorAll('[data-board-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectBoard(button.dataset.boardId).catch((error) => {
          document.getElementById('secondary-body').innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
        });
      });
    });
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

async function loadShell(preferredModuleId = null, preferredBoardId = null) {
  const [health, tree, modules, projects, inventoryDashboard, moduleCatalog, boardCatalog] = await Promise.all([
    fetchJson('/health'),
    fetchJson('/api/stage4/tree'),
    fetchJson('/api/stage4/modules?includeChildren=false'),
    fetchJson('/api/stage4/projects?includeChildren=false'),
    fetchJson('/api/stage4/dashboard/inventory'),
    fetchJson('/api/stage4/dashboard/modules'),
    fetchJson('/api/stage4/dashboard/boards')
  ]);

  state.tree = tree;
  state.modules = modules;
  state.projects = projects;
  state.inventoryDashboard = inventoryDashboard;
  state.moduleCatalog = moduleCatalog;
  state.boardCatalog = boardCatalog;
  state.selectedModuleId = preferredModuleId || state.selectedModuleId || moduleCatalog.modules[0]?.moduleId || null;
  state.selectedBoardId = preferredBoardId || state.selectedBoardId || boardCatalog.boards[0]?.boardId || null;

  setText('api-runtime', `runtime: ${health.runtime}`);
  setText('model-stamp', `tree: ${tree.generatedAt}`);
  setText('root-count', String(tree.roots.length));
  setText('module-count', String(tree.summary.moduleCount));
  setText('board-count', String(tree.summary.boardCount));
  setText('project-count', String(tree.summary.projectCount));

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.onclick = () => setActiveView(button.dataset.view);
  });

  if (state.selectedModuleId) {
    state.moduleHelp = await fetchJson(`/api/stage4/module-help/${encodeURIComponent(state.selectedModuleId)}`);
  }
  if (state.selectedBoardId) {
    state.boardDetail = await fetchJson(`/api/stage4/board-detail/${encodeURIComponent(state.selectedBoardId)}`);
  }

  setActiveView(state.currentView);
}

loadShell().catch((error) => {
  setText('api-runtime', 'runtime: error');
  setText('model-stamp', 'tree: unavailable');
  document.getElementById('primary-title').textContent = 'Shell failed to load';
  document.getElementById('primary-body').innerHTML = `<div class="empty-note">${error.message}</div>`;
});
