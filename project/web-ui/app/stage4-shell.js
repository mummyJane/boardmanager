const state = {
  currentView: "inventory",
  tree: null,
  modules: null,
  boards: null,
  projects: null,
  projectCatalog: null,
  selectedProjectId: null,
  projectDetail: null,
  projectCatalog: null,
  selectedProjectId: null,
  projectDetail: null,
  inventoryDashboard: null,
  moduleCatalog: null,
  boardCatalog: null,
  boardCreateCandidates: null,
  selectedModuleId: null,
  selectedBoardId: null,
  moduleHelp: null,
  boardDetail: null,
  boardEditMode: false,
  boardEditPayload: null,
  boardValidationStatus: null,
  boardCreateMode: false,
  boardCreateKind: 'unit',
  boardCreateStatus: null,
  boardCreateGuess: null,
  boardManualOptions: null,
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

async function putJson(url, payload) {
  const response = await fetch(url, {
    method: 'PUT',
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

function renderBoardToolbar() {
  return `
    <div class="action-row">
      <button class="action-button" type="button" id="board-edit-toggle">${state.boardEditMode ? 'Back to detail' : 'Edit board'}</button>
      <button class="action-button" type="button" id="board-create-toggle">${state.boardCreateMode && state.boardCreateKind === 'unit' ? 'Back to detail' : 'Create from unit'}</button>
      <button class="action-button" type="button" id="board-manual-toggle">${state.boardCreateMode && state.boardCreateKind === 'manual' ? 'Back to detail' : 'Create manual'}</button>
      <button class="action-button" type="button" id="board-validation-toggle">Validate board</button>
      ${state.selectedBoardId ? `<span class="status-chip">selected ${escapeHtml(state.selectedBoardId)}</span>` : ''}
    </div>`;
}

function renderBoardStatus() {
  const status = state.boardValidationStatus || state.boardCreateStatus;
  if (!status) {
    return '';
  }
  return `<div class="status-banner ${status.kind}">${escapeHtml(status.message)}</div>`;
}

function renderBoardEditPanel() {
  if (!state.boardEditPayload) {
    return `<div class="empty-note">Load a board to edit its board-local config.</div>`;
  }

  const board = state.boardEditPayload.board;
  const controllerOptions = (state.boardEditPayload.options?.controllers ?? []).map((entry) => `<option value="${escapeHtml(entry.moduleId)}" ${entry.moduleId === board.controllerModuleId ? 'selected' : ''}>${escapeHtml(entry.title)} (${escapeHtml(entry.moduleId)})</option>`).join('');
  const sourcesText = (board.sources ?? []).join('\n');
  const jsonText = (value) => JSON.stringify(value ?? (Array.isArray(value) ? [] : {}), null, 2);
  return `
    <form id="board-edit-form" class="form-stack">
      <div class="eyebrow">Edit board config</div>
      <div class="form-grid">
        <label class="field-label">Board id
          <input class="text-input" name="boardId" value="${escapeHtml(board.boardId)}" readonly>
        </label>
        <label class="field-label">Display name
          <input class="text-input" name="displayName" value="${escapeHtml(board.displayName ?? '')}" required>
        </label>
        <label class="field-label">Vendor
          <input class="text-input" name="vendor" value="${escapeHtml(board.vendor ?? '')}" required>
        </label>
        <label class="field-label">Revision
          <input class="text-input" name="revision" value="${escapeHtml(board.revision ?? '1.0')}" required>
        </label>
        <label class="field-label">Product SKU
          <input class="text-input" name="productSku" value="${escapeHtml(board.productSku ?? '')}">
        </label>
        <label class="field-label">Controller module
          <select class="text-input" name="controllerModuleId" required>
            <option value="">Select controller</option>
            ${controllerOptions}
          </select>
        </label>
      </div>
      <label class="field-label">Capabilities JSON
        <textarea class="text-area" name="capabilities" rows="8">${escapeHtml(jsonText(board.capabilities ?? {}))}</textarea>
      </label>
      <label class="field-label">Power JSON
        <textarea class="text-area" name="power" rows="8">${escapeHtml(jsonText(board.power ?? {}))}</textarea>
      </label>
      <label class="field-label">Signals JSON
        <textarea class="text-area" name="signals" rows="12">${escapeHtml(jsonText(board.signals ?? []))}</textarea>
      </label>
      <label class="field-label">Buses JSON
        <textarea class="text-area" name="buses" rows="14">${escapeHtml(jsonText(board.buses ?? []))}</textarea>
      </label>
      <label class="field-label">Connectors JSON
        <textarea class="text-area" name="connectors" rows="10">${escapeHtml(jsonText(board.connectors ?? []))}</textarea>
      </label>
      <label class="field-label">Boot sequence JSON
        <textarea class="text-area" name="bootSequence" rows="10">${escapeHtml(jsonText(board.bootSequence ?? []))}</textarea>
      </label>
      <label class="field-label">Sources
        <textarea class="text-area" name="sources" rows="6" placeholder="One source URL per line">${escapeHtml(sourcesText)}</textarea>
      </label>
      <label class="field-label">Help markdown
        <textarea class="text-area" name="helpMarkdown" rows="12">${escapeHtml(board.helpMarkdown ?? '')}</textarea>
      </label>
      <div class="action-row">
        <button class="action-button primary" type="submit">Save board config</button>
        <span class="empty-inline">Edit board-local metadata and JSON arrays for signals, buses, connectors, and boot order.</span>
      </div>
    </form>`;
}

function renderBoardManualCreatePanel() {
  const templates = state.boardManualOptions?.templates ?? [];
  const controllers = state.boardManualOptions?.controllers ?? [];
  const templateOptions = templates.map((entry) => `<option value="${escapeHtml(entry.boardId)}">${escapeHtml(entry.title)} (${escapeHtml(entry.boardId)})</option>`).join('');
  const controllerOptions = controllers.map((entry) => `<option value="${escapeHtml(entry.moduleId)}">${escapeHtml(entry.title)} (${escapeHtml(entry.moduleId)})</option>`).join('');
  return `
    <form id="board-manual-form" class="form-stack">
      <div class="eyebrow">Create board manually</div>
      <div class="form-grid">
        <label class="field-label">Template board
          <select class="text-input" name="templateBoardId">
            <option value="">Blank board</option>
            ${templateOptions}
          </select>
        </label>
        <label class="field-label">Controller module
          <select class="text-input" name="controllerModuleId">
            <option value="">Select controller for blank board</option>
            ${controllerOptions}
          </select>
        </label>
        <label class="field-label">Board id
          <input class="text-input" name="boardId" placeholder="user_new_board" required pattern="[a-z][a-z0-9_]*">
        </label>
        <label class="field-label">Display name
          <input class="text-input" name="displayName" placeholder="User New Board" required>
        </label>
        <label class="field-label">Vendor
          <input class="text-input" name="vendor" placeholder="Vendor" required>
        </label>
        <label class="field-label">Revision
          <input class="text-input" name="revision" value="1.0" required>
        </label>
      </div>
      <div class="action-row">
        <button class="action-button primary" type="submit">Create manual board</button>
        <span class="empty-inline">Choose a template to clone, or leave it blank and pick a controller module.</span>
      </div>
    </form>`;
}

function renderBoardCreatePanel() {
  const units = state.boardCreateCandidates?.units ?? [];
  const options = units.map((unit) => `<option value="${escapeHtml(unit.unitId)}">${escapeHtml(unit.label || unit.boardId || unit.unitId)} ${unit.port ? `(${escapeHtml(unit.port)})` : ''}</option>`).join('');
  const guess = state.boardCreateGuess?.guess ?? {};
  return `
    <form id="board-create-form" class="form-stack">
      <div class="eyebrow">Create board from discovered unit</div>
      <div class="form-grid">
        <label class="field-label">Discovered unit
          <select class="text-input" name="unitId" id="board-create-unit" required>
            <option value="">Select unit</option>
            ${options}
          </select>
        </label>
        <label class="field-label">Board id
          <input class="text-input" name="boardId" value="${escapeHtml(guess.boardId || '')}" placeholder="draft_new_board" required pattern="[a-z][a-z0-9_]*">
        </label>
        <label class="field-label">Display name
          <input class="text-input" name="displayName" value="${escapeHtml(guess.displayName || '')}" placeholder="Discovered Board" required>
        </label>
        <label class="field-label">Vendor
          <input class="text-input" name="vendor" value="${escapeHtml(guess.vendor || '')}" placeholder="Vendor" required>
        </label>
        <label class="field-label">Revision
          <input class="text-input" name="revision" value="${escapeHtml(guess.revision || '1.0')}" placeholder="1.0" required>
        </label>
      </div>
      <div>
        <strong>Guess notes</strong>
        ${(guess.notes ?? []).length ? `<ul class="inline-list">${guess.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<div class="empty-inline">Load a unit to inspect the guessed board shape.</div>'}
      </div>
      <div class="action-row">
        <button class="action-button" type="button" id="board-load-guess">Load guess</button>
        <button class="action-button primary" type="submit">Create board draft</button>
      </div>
    </form>`;
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
  const validation = detail.validation ?? {};
  const validationCandidates = validation.candidates ?? [];
  const latestValidation = validation.latest ?? null;
  const candidateOptions = validationCandidates.map((entry) => `<option value="${escapeHtml(entry.unitId)}">${escapeHtml(entry.label || entry.unitId)}${entry.port ? ` (${escapeHtml(entry.port)})` : ''}</option>`).join('');
  const latestValidationSummary = !latestValidation
    ? '<div class="empty-inline">No validation report captured for this board yet.</div>'
    : `<div class="meta-row"><span class="meta-chip">${latestValidation.summary?.overallPass ? 'pass' : 'fail'}</span><span class="meta-chip">failing ${latestValidation.summary?.failingCheckCount ?? 0}</span><span class="meta-chip">warnings ${latestValidation.summary?.warningCount ?? 0}</span><span class="meta-chip">${escapeHtml(latestValidation.generatedAt ?? '')}</span></div>${(latestValidation.failingChecks ?? []).length ? `<ul class="inline-list">${latestValidation.failingChecks.map((entry) => `<li><code>${escapeHtml(entry.checkId || 'check')}</code>${entry.notes?.length ? `: ${escapeHtml(entry.notes.join(' | '))}` : ''}</li>`).join('')}</ul>` : '<div class="empty-inline">No failing checks in the latest report.</div>'}`;

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
        <strong>Board validation</strong>
        <form id="board-validation-form" class="form-stack">
          <div class="form-grid">
            <label class="field-label">Attached unit
              <select class="text-input" name="unitId" required>
                <option value="">Select unit</option>
                ${candidateOptions}
              </select>
            </label>
            <label class="field-label">Capture seconds
              <input class="text-input" name="seconds" value="4" type="number" min="1" max="30" required>
            </label>
          </div>
          <div class="action-row">
            <button class="action-button primary" type="submit">Run validation</button>
            <span class="empty-inline">Compares the current board config against the selected attached unit using the Stage 3 validation runner.</span>
          </div>
        </form>
        ${validationCandidates.length ? `<ul class="inline-list">${validationCandidates.map((entry) => `<li><code>${escapeHtml(entry.unitId)}</code>${entry.port ? ` on ${escapeHtml(entry.port)}` : ''}${entry.latestValidation ? ` · ${entry.latestValidation.overallPass ? 'pass' : `fail (${entry.latestValidation.failingCheckCount ?? 0})`}` : ' · no report yet'}</li>`).join('')}</ul>` : '<div class="empty-inline">No attached units currently match this board.</div>'}
        <div class="detail-stack">${latestValidationSummary}</div>
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
        <strong>Board validation</strong>
        <form id="board-validation-form" class="form-stack">
          <div class="form-grid">
            <label class="field-label">Attached unit
              <select class="text-input" name="unitId" required>
                <option value="">Select unit</option>
                ${candidateOptions}
              </select>
            </label>
            <label class="field-label">Capture seconds
              <input class="text-input" name="seconds" value="4" type="number" min="1" max="30" required>
            </label>
          </div>
          <div class="action-row">
            <button class="action-button primary" type="submit">Run validation</button>
            <span class="empty-inline">Compares the current board config against the selected attached unit using the Stage 3 validation runner.</span>
          </div>
        </form>
        ${validationCandidates.length ? `<ul class="inline-list">${validationCandidates.map((entry) => `<li><code>${escapeHtml(entry.unitId)}</code>${entry.port ? ` on ${escapeHtml(entry.port)}` : ''}${entry.latestValidation ? ` · ${entry.latestValidation.overallPass ? 'pass' : `fail (${entry.latestValidation.failingCheckCount ?? 0})`}` : ' · no report yet'}</li>`).join('')}</ul>` : '<div class="empty-inline">No attached units currently match this board.</div>'}
        <div class="detail-stack">${latestValidationSummary}</div>
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
  state.boardCreateMode = false;
  state.boardEditMode = false;
  state.boardEditPayload = null;
  renderPrimary('boards');
  const detailPayload = await fetchJson(`/api/stage4/board-detail/${encodeURIComponent(boardId)}`);
  if (state.selectedBoardId !== boardId) {
    return;
  }
  state.boardDetail = detailPayload;
  renderPreview('boards');
}

async function loadBoardEdit(boardId) {
  const payload = await fetchJson(`/api/stage4/board-edit/${encodeURIComponent(boardId)}`);
  if (state.selectedBoardId !== boardId) {
    return;
  }
  state.boardEditPayload = payload;
  renderPreview('boards');
}

async function loadBoardGuess(unitId) {
  if (!unitId) {
    state.boardCreateGuess = null;
    renderPreview('boards');
    return;
  }
  state.boardCreateGuess = await fetchJson(`/api/stage4/board-create-guess/${encodeURIComponent(unitId)}`);
  renderPreview('boards');
}

async function handleBoardCreateSubmit(form) {
  const formData = new FormData(form);
  const payload = {
    unitId: String(formData.get('unitId') || '').trim(),
    boardId: String(formData.get('boardId') || '').trim(),
    displayName: String(formData.get('displayName') || '').trim(),
    vendor: String(formData.get('vendor') || '').trim(),
    revision: String(formData.get('revision') || '').trim(),
  };
  const result = await postJson('/api/stage4/board-create-from-unit', payload);
  state.boardCreateStatus = { kind: 'success', message: `Created ${result.created.boardId}` };
  state.boardValidationStatus = null;
  state.boardCreateMode = false;
  await loadShell(state.selectedModuleId, result.created.boardId);
  renderPreview('boards');
}

async function handleBoardManualCreateSubmit(form) {
  const formData = new FormData(form);
  const payload = {
    templateBoardId: String(formData.get('templateBoardId') || '').trim() || null,
    controllerModuleId: String(formData.get('controllerModuleId') || '').trim() || null,
    boardId: String(formData.get('boardId') || '').trim(),
    displayName: String(formData.get('displayName') || '').trim(),
    vendor: String(formData.get('vendor') || '').trim(),
    revision: String(formData.get('revision') || '').trim(),
  };
  const result = await postJson('/api/stage4/board-create-manual', payload);
  state.boardCreateStatus = { kind: 'success', message: `Created ${result.created.boardId}` };
  state.boardValidationStatus = null;
  state.boardCreateMode = false;
  await loadShell(state.selectedModuleId, result.created.boardId);
  renderPreview('boards');
}

async function handleBoardValidationSubmit(form) {
  if (!state.selectedBoardId) {
    throw new Error('Select a board first.');
  }
  const formData = new FormData(form);
  const payload = {
    boardId: state.selectedBoardId,
    unitId: String(formData.get('unitId') || '').trim(),
    seconds: Number(String(formData.get('seconds') || '4').trim() || '4'),
  };
  const result = await postJson('/api/stage4/board-validate', payload);
  const latest = result.latest ?? {};
  const overallPass = latest.summary?.overallPass;
  state.boardValidationStatus = {
    kind: overallPass ? 'success' : 'error',
    message: overallPass
      ? `Validation passed for ${payload.unitId}`
      : `Validation reported ${latest.summary?.failingCheckCount ?? 0} failing checks for ${payload.unitId}`,
  };
  await loadShell(state.selectedModuleId, state.selectedBoardId);
  renderPreview('boards');
}

async function handleBoardEditSubmit(form) {
  const formData = new FormData(form);
  const parseJsonField = (name) => {
    const raw = String(formData.get(name) || '').trim();
    return raw ? JSON.parse(raw) : (name === 'capabilities' || name === 'power' ? {} : []);
  };
  const sources = String(formData.get('sources') || '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const payload = {
    boardId: String(formData.get('boardId') || '').trim(),
    displayName: String(formData.get('displayName') || '').trim(),
    vendor: String(formData.get('vendor') || '').trim(),
    revision: String(formData.get('revision') || '').trim(),
    productSku: String(formData.get('productSku') || '').trim(),
    controllerModuleId: String(formData.get('controllerModuleId') || '').trim(),
    capabilities: parseJsonField('capabilities'),
    power: parseJsonField('power'),
    signals: parseJsonField('signals'),
    buses: parseJsonField('buses'),
    connectors: parseJsonField('connectors'),
    bootSequence: parseJsonField('bootSequence'),
    sources,
    helpMarkdown: String(formData.get('helpMarkdown') || ''),
  };
  const result = await putJson(`/api/stage4/boards/${encodeURIComponent(payload.boardId)}`, payload);
  state.boardCreateStatus = { kind: 'success', message: `Updated ${result.updated.boardId}` };
  state.boardValidationStatus = null;
  state.boardEditMode = false;
  state.boardEditPayload = null;
  await loadShell(state.selectedModuleId, result.updated.boardId);
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

function bindBoardPreviewActions() {
  document.getElementById('board-edit-toggle')?.addEventListener('click', () => {
    const nextMode = !state.boardEditMode;
    state.boardEditMode = nextMode;
    state.boardCreateMode = false;
    state.boardCreateStatus = null;
    state.boardValidationStatus = null;
    if (!nextMode) {
      state.boardEditPayload = null;
      renderPreview('boards');
      return;
    }
    if (!state.selectedBoardId) {
      state.boardCreateStatus = { kind: 'error', message: 'Select a board first.' };
      state.boardEditMode = false;
      renderPreview('boards');
      return;
    }
    state.boardCreateStatus = { kind: 'info', message: 'Loading board editor...' };
    renderPreview('boards');
    loadBoardEdit(state.selectedBoardId).catch((error) => {
      state.boardCreateStatus = { kind: 'error', message: error.message };
      state.boardEditMode = false;
      renderPreview('boards');
    });
  });

  document.getElementById('board-create-toggle')?.addEventListener('click', () => {
    state.boardEditMode = false;
    state.boardEditPayload = null;
    state.boardValidationStatus = null;
    state.boardCreateMode = !(state.boardCreateMode && state.boardCreateKind === 'unit');
    state.boardCreateKind = 'unit';
    state.boardCreateStatus = null;
    renderPreview('boards');
  });

  document.getElementById('board-manual-toggle')?.addEventListener('click', () => {
    state.boardEditMode = false;
    state.boardEditPayload = null;
    state.boardValidationStatus = null;
    state.boardCreateMode = !(state.boardCreateMode && state.boardCreateKind === 'manual');
    state.boardCreateKind = 'manual';
    state.boardCreateStatus = null;
    renderPreview('boards');
  });

  document.getElementById('board-validation-toggle')?.addEventListener('click', () => {
    const form = document.getElementById('board-validation-form');
    if (!form) {
      state.boardValidationStatus = { kind: 'error', message: 'Select a board with validation candidates first.' };
      renderPreview('boards');
      return;
    }
    form.requestSubmit();
  });

  document.getElementById('board-load-guess')?.addEventListener('click', () => {
    const unitId = document.getElementById('board-create-unit')?.value || '';
    loadBoardGuess(unitId).catch((error) => {
      state.boardCreateStatus = { kind: 'error', message: error.message };
      renderPreview('boards');
    });
  });


  const validationForm = document.getElementById('board-validation-form');
  if (validationForm) {
    validationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        state.boardValidationStatus = { kind: 'info', message: 'Running board validation...' };
        renderPreview('boards');
        await handleBoardValidationSubmit(validationForm);
      } catch (error) {
        state.boardValidationStatus = { kind: 'error', message: error.message };
        renderPreview('boards');
      }
    });
  }

  const form = document.getElementById('board-create-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        state.boardCreateStatus = { kind: 'info', message: 'Creating board draft...' };
        renderPreview('boards');
        await handleBoardCreateSubmit(form);
      } catch (error) {
        state.boardCreateStatus = { kind: 'error', message: error.message };
        state.boardCreateMode = true;
        state.boardCreateKind = 'unit';
        renderPreview('boards');
      }
    });
  }

  const manualForm = document.getElementById('board-manual-form');
  if (manualForm) {
    manualForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        state.boardCreateStatus = { kind: 'info', message: 'Creating manual board...' };
        renderPreview('boards');
        await handleBoardManualCreateSubmit(manualForm);
      } catch (error) {
        state.boardCreateStatus = { kind: 'error', message: error.message };
        state.boardCreateMode = true;
        state.boardCreateKind = 'manual';
        renderPreview('boards');
      }
    });
  }

  const editForm = document.getElementById('board-edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        state.boardCreateStatus = { kind: 'info', message: 'Saving board config...' };
        renderPreview('boards');
        await handleBoardEditSubmit(editForm);
      } catch (error) {
        state.boardCreateStatus = { kind: 'error', message: error.message };
        state.boardEditMode = true;
        renderPreview('boards');
      }
    });
  }
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
    secondaryTitle.textContent = state.boardEditMode
      ? 'Edit board config'
      : state.boardCreateMode
        ? state.boardCreateKind === 'manual' ? 'Create board manually' : 'Create board from unit'
        : state.boardDetail ? `${state.boardDetail.board.title} Detail` : `${titles[view].title} Preview`;
    secondaryBody.innerHTML = `${renderBoardToolbar()}${renderBoardStatus()}${state.boardEditMode ? renderBoardEditPanel() : (state.boardCreateMode ? (state.boardCreateKind === 'manual' ? renderBoardManualCreatePanel() : renderBoardCreatePanel()) : renderBoardDetailPanel())}`;
    bindBoardPreviewActions();
    return;
  }

  if (view === "projects" && state.projectCatalog) {
    secondaryTitle.textContent = state.projectDetail ? `${state.projectDetail.project.displayName} Detail` : `${titles[view].title} Preview`;
    if (!state.projectDetail) {
      secondaryBody.innerHTML = `<div class="empty-note">Select a project to inspect its board target, app roots, deployment policy, and overrides.</div>`;
      return;
    }
    const detail = state.projectDetail.project;
    const items = [
      { title: 'Board target', description: detail.boardTitle ?? detail.boardId, meta: [detail.boardId ?? 'unknown board'] },
      { title: 'App layout', description: `App root ${detail.app?.appRoot ?? 'n/a'}`, meta: [detail.app?.userCodeRoot ?? 'n/a', detail.app?.stableApi ?? 'n/a'] },
      { title: 'Firmware target', description: detail.firmwareTarget?.family ?? 'unknown family', meta: [detail.firmwareTarget?.entryPoint ?? 'n/a'] },
      { title: 'Deployment', description: detail.security?.classification ?? 'standard', meta: [(detail.deployment?.transports ?? []).join(', ') || 'no transport', `signing ${detail.ota?.signing ?? 'n/a'}`, `encryption ${detail.ota?.encryption ?? 'n/a'}`] },
      { title: 'Overrides', description: `Part overrides ${(Object.keys(detail.partOverrides ?? {})).length}`, meta: [`signal overrides ${(Object.keys(detail.signalOverrides ?? {})).length}`, detail.sourcePath ?? 'n/a'] }
    ];
    secondaryBody.innerHTML = renderList(items);
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

  if (view === "projects" && state.projectCatalog) {
    primaryBody.innerHTML = `<ul class="data-list">${state.projectCatalog.projects.map((project) => `
      <li class="data-card selectable-card${state.selectedProjectId === project.projectId ? ' is-selected' : ''}">
        <button class="card-button" data-project-id="${project.projectId}" type="button">
          <h4>${project.title}</h4>
          <div>${project.boardTitle ?? project.boardId} · ${project.firmwareFamily ?? 'unknown family'} · ${project.appId ?? 'no appId'}</div>
          <div class="meta-row">
            <span class="meta-chip">${project.projectId}</span>
            <span class="meta-chip">${project.securityClassification ?? 'standard'}</span>
            <span class="meta-chip">${project.otaSupported ? 'ota' : 'no ota'}</span>
            <span class="meta-chip">part overrides ${project.partOverrideCount}</span>
          </div>
        </button>
      </li>`).join('')}</ul>`;
    document.querySelectorAll('[data-project-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectProject(button.dataset.projectId).catch((error) => {
          const secondaryTitle = document.getElementById('secondary-title');
          const secondaryBody = document.getElementById('secondary-body');
          secondaryTitle.textContent = 'Project detail failed';
          secondaryBody.innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
        });
      });
    });
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

async function loadShell(preferredModuleId = null, preferredBoardId = null, preferredProjectId = null) {
  const [health, tree, modules, projects, inventoryDashboard, moduleCatalog, boardCatalog, projectCatalog, boardCreateCandidates, boardManualOptions] = await Promise.all([
    fetchJson('/health'),
    fetchJson('/api/stage4/tree'),
    fetchJson('/api/stage4/modules?includeChildren=false'),
    fetchJson('/api/stage4/projects?includeChildren=false'),
    fetchJson('/api/stage4/dashboard/inventory'),
    fetchJson('/api/stage4/dashboard/modules'),
    fetchJson('/api/stage4/dashboard/boards'),
    fetchJson('/api/stage4/dashboard/projects'),
    fetchJson('/api/stage4/board-create-candidates'),
    fetchJson('/api/stage4/board-create-manual-options')
  ]);

  state.tree = tree;
  state.modules = modules;
  state.projects = projects;
  state.projectCatalog = projectCatalog;
  state.inventoryDashboard = inventoryDashboard;
  state.moduleCatalog = moduleCatalog;
  state.boardCatalog = boardCatalog;
  state.boardCreateCandidates = boardCreateCandidates;
  state.boardManualOptions = boardManualOptions;
  state.selectedModuleId = preferredModuleId || state.selectedModuleId || moduleCatalog.modules[0]?.moduleId || null;
  state.selectedBoardId = preferredBoardId || state.selectedBoardId || boardCatalog.boards[0]?.boardId || null;
  state.selectedProjectId = preferredProjectId || state.selectedProjectId || projectCatalog.projects[0]?.projectId || null;

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
  if (state.selectedProjectId) {
    state.projectDetail = await fetchJson(`/api/stage4/project-detail/${encodeURIComponent(state.selectedProjectId)}`);
  }

  setActiveView(state.currentView);
}

loadShell().catch((error) => {
  setText('api-runtime', 'runtime: error');
  setText('model-stamp', 'tree: unavailable');
  document.getElementById('primary-title').textContent = 'Shell failed to load';
  document.getElementById('primary-body').innerHTML = `<div class="empty-note">${error.message}</div>`;
});
