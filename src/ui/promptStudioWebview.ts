import * as vscode from "vscode";
import { GovernanceScope } from "../governanceLoader";
import { GovernancePreset } from "../promptCompiler";
import { TierSelection } from "../tierResolver";
import { TaskMode } from "../taskModeResolver";

type WebviewMessage =
  | {
      command: "generatePreview";
      userTask: string;
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
      taskMode: TaskMode | "auto";
    }
  | {
      command: "copyPrompt";
      userTask: string;
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
      taskMode: TaskMode | "auto";
    }
  | {
      command: "runPolicyCheck";
      userTask: string;
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
      taskMode: TaskMode | "auto";
    }
  | {
      command: "initSession";
      userTask: string;
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
      taskMode: TaskMode | "auto";
    };

export interface PromptStudioState {
  tier: TierSelection;
  preset: GovernancePreset;
  taskMode: TaskMode | "auto";
  resolvedTaskMode: TaskMode;
  scopes: GovernanceScope[];
  contextFiles: string[];
  previewPrompt: string;
  policyState: "OK" | "WARN" | "DENY";
  detectedStack: string[];
  hasCustomInstructions: boolean;
}

export interface PromptStudioHandlers {
  onGeneratePreview: (message: Extract<WebviewMessage, { command: "generatePreview" }>) => Promise<void>;
  onCopyPrompt: (message: Extract<WebviewMessage, { command: "copyPrompt" }>) => Promise<void>;
  onRunPolicyCheck: (message: Extract<WebviewMessage, { command: "runPolicyCheck" }>) => Promise<void>;
  onInitSession: (message: Extract<WebviewMessage, { command: "initSession" }>) => Promise<void>;
}

export class PromptStudioWebview {
  private static currentPanel: PromptStudioWebview | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly handlers: PromptStudioHandlers,
    initialState: PromptStudioState
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(this.panel.webview, initialState);

    this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.command === "generatePreview") {
        await this.handlers.onGeneratePreview(message);
      } else if (message.command === "copyPrompt") {
        await this.handlers.onCopyPrompt(message);
      } else if (message.command === "runPolicyCheck") {
        await this.handlers.onRunPolicyCheck(message);
      } else if (message.command === "initSession") {
        await this.handlers.onInitSession(message);
      }
    });

    this.panel.onDidDispose(() => {
      PromptStudioWebview.currentPanel = undefined;
    });
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    handlers: PromptStudioHandlers,
    initialState: PromptStudioState
  ): PromptStudioWebview {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (PromptStudioWebview.currentPanel) {
      PromptStudioWebview.currentPanel.panel.reveal(column);
      PromptStudioWebview.currentPanel.updateState(initialState);
      return PromptStudioWebview.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "promptStudio",
      "Prompt Studio",
      column ?? vscode.ViewColumn.One,
      { enableScripts: true }
    );

    PromptStudioWebview.currentPanel = new PromptStudioWebview(panel, handlers, initialState);
    context.subscriptions.push(panel);
    return PromptStudioWebview.currentPanel;
  }

  public updateState(state: PromptStudioState): void {
    this.panel.webview.postMessage({ command: "stateUpdate", state });
  }

  private getHtml(_webview: vscode.Webview, initialState: PromptStudioState): string {
    const nonce = Date.now().toString();
    const initialJson = JSON.stringify(initialState).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Studio</title>
  <style>
    :root {
      --bg: #0f172a;
      --bg-gradient: #1e293b;
      --card: #111827;
      --card-elevated: #1f2937;
      --ink: #e5e7eb;
      --muted: #94a3b8;
      --accent: #0ea5e9;
      --accent-secondary: #3b82f6;
      --accent-ghost: #334155;
      --accent-soft: #1d4ed8;
      --border: #334155;
      --ok: #16a34a; --ok-fg: #bbf7d0;
      --warn: #b45309; --warn-fg: #fde68a;
      --deny: #b91c1c; --deny-fg: #fecaca;
      --mode-a: #0c4a6e; --mode-fg: #bae6fd;
      --session-ok: #14532d; --session-ok-fg: #86efac;
      --session-warn: #451a03; --session-warn-fg: #fed7aa;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      margin: 0;
      background: radial-gradient(circle at top right, #1e293b 0%, var(--bg) 52%, #020617 100%);
      color: var(--ink);
      padding: 16px;
      font-size: 14px;
    }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 10px 24px rgba(2,6,23,0.45);
    }
    h1 { margin: 0 0 10px; font-size: 1.3rem; }
    h2 { margin: 0 0 10px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    label { color: var(--muted); font-size: 0.82rem; display: block; margin-bottom: 3px; }
    textarea, select {
      width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px;
      font-size: 0.9rem; background: var(--card-elevated); color: var(--ink);
    }
    textarea:focus, select:focus { outline: 1px solid var(--accent); border-color: var(--accent); }
    textarea { min-height: 110px; resize: vertical; }
    .field { margin-bottom: 10px; }
    .scopes { display: grid; grid-template-columns: repeat(2, minmax(110px, 1fr)); gap: 5px; }
    .scopes label { color: var(--ink); font-size: 0.85rem; display: flex; align-items: center; gap: 5px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    button {
      border: 1px solid transparent; border-radius: 10px; padding: 8px 14px;
      font-weight: 600; cursor: pointer; color: #fff; background: var(--accent);
      transition: transform 120ms ease, opacity 120ms ease;
      font-size: 0.88rem;
    }
    button.secondary { background: var(--accent-secondary); }
    button.ghost { background: var(--accent-ghost); border-color: var(--border); }
    button.init { background: #065f46; border-color: #047857; }
    button:hover { transform: translateY(-1px); opacity: 0.92; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      border-radius: 999px; padding: 4px 12px; font-size: 0.82rem; font-weight: 600;
    }
    .badge.ok { background: var(--ok); color: var(--ok-fg); }
    .badge.warn { background: var(--warn); color: var(--warn-fg); }
    .badge.deny { background: var(--deny); color: var(--deny-fg); }
    .badge.mode { background: var(--mode-a); color: var(--mode-fg); }
    .badge.session-ok { background: var(--session-ok); color: var(--session-ok-fg); }
    .badge.session-warn { background: var(--session-warn); color: var(--session-warn-fg); }
    .header-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .bundle-row { display: flex; flex-direction: column; gap: 8px; }
    .bundle-label { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag {
      border-radius: 6px; padding: 2px 8px; font-size: 0.78rem; font-weight: 500;
      background: var(--mode-a); color: var(--mode-fg);
    }
    .tag.scope { background: #1e3a5f; color: #93c5fd; }
    .tag.file { background: #1a2e1c; color: #86efac; font-family: monospace; font-size: 0.72rem; }
    .tag.stack { background: #1c1917; color: #d6d3d1; }
  </style>
</head>
<body>
  <div class="header-row">
    <h1 style="margin:0;">Prompt Studio</h1>
    <span class="badge" id="policyBadge">OK</span>
    <span class="badge session-warn" id="sessionBadge">Bootstrap requerido</span>
    <span class="badge mode" id="modeBadge">—</span>
  </div>

  <div class="grid">

    <section class="card" style="grid-column: 1 / -1;">
      <h2>Editor de Prompt</h2>
      <textarea id="userTask" placeholder="Escribe la tarea para Copilot..."></textarea>
    </section>

    <section class="card">
      <h2>Configuración de Gobernanza</h2>
      <div class="field">
        <label for="taskMode">Modo de tarea</label>
        <select id="taskMode">
          <option value="auto">Auto (detección heurística)</option>
          <option value="design-system">Diseño de sistema</option>
          <option value="debugging">Debugging</option>
          <option value="new-feature">Feature nueva</option>
        </select>
      </div>
      <div class="field">
        <label for="tier">Nivel de gobernanza</label>
        <select id="tier">
          <option value="auto">Auto</option>
          <option value="1">1 — Prototipo</option>
          <option value="2">2 — Producción</option>
          <option value="3">3 — Empresarial</option>
        </select>
      </div>
      <div class="field">
        <label for="preset">Perfil</label>
        <select id="preset">
          <option value="Fast">Fast</option>
          <option value="Safe">Safe</option>
          <option value="Strict">Strict</option>
        </select>
      </div>
      <div class="field">
        <div style="font-weight:600; margin-bottom:6px; font-size:0.85rem;">Alcances</div>
        <div class="scopes">
          <label><input type="checkbox" value="Security" checked /> Security</label>
          <label><input type="checkbox" value="Architecture" checked /> Architecture</label>
          <label><input type="checkbox" value="Dependencies" checked /> Dependencies</label>
          <label><input type="checkbox" value="Workflow" checked /> Workflow</label>
          <label><input type="checkbox" value="Compliance" checked /> Compliance</label>
          <label><input type="checkbox" value="Observability" checked /> Observability</label>
          <label><input type="checkbox" value="Cost" checked /> Cost</label>
          <label><input type="checkbox" value="Troubleshooting" checked /> Troubleshooting</label>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Paquete de Contexto</h2>
      <div class="bundle-row">
        <div>
          <div class="bundle-label">Nivel | Perfil</div>
          <span id="bundleTierPreset">— | —</span>
        </div>
        <div>
          <div class="bundle-label">Modo de tarea activo</div>
          <span id="bundleMode">—</span>
        </div>
        <div>
          <div class="bundle-label">Alcances activos</div>
          <div class="tag-list" id="bundleScopes"></div>
        </div>
        <div>
          <div class="bundle-label">Stack detectado</div>
          <div class="tag-list" id="bundleStack"></div>
        </div>
        <div>
          <div class="bundle-label">Archivos de gobernanza</div>
          <div class="tag-list" id="bundleFiles"></div>
        </div>
        <div>
          <div class="bundle-label">Instrucciones del repositorio</div>
          <span id="instrStatus" style="font-size:0.82rem;">—</span>
        </div>
      </div>
    </section>

    <section class="card" style="grid-column: 1 / -1;">
      <h2>Acciones</h2>
      <div class="actions">
        <button id="btnInit" class="init">Inicializar sesión gobernada</button>
        <button id="btnGenerate" class="secondary">Generar vista previa</button>
        <button id="btnCopy">Copiar prompt gobernado</button>
        <button id="btnPolicy" class="ghost">Ejecutar policy check</button>
      </div>
    </section>

    <section class="card" style="grid-column: 1 / -1;">
      <h2>Prompt Gobernado (Vista Previa)</h2>
      <textarea id="preview" readonly></textarea>
    </section>

  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const initialState = ${initialJson};

    const el = {
      userTask:       document.getElementById("userTask"),
      tier:           document.getElementById("tier"),
      preset:         document.getElementById("preset"),
      taskMode:       document.getElementById("taskMode"),
      preview:        document.getElementById("preview"),
      policyBadge:    document.getElementById("policyBadge"),
      sessionBadge:   document.getElementById("sessionBadge"),
      modeBadge:      document.getElementById("modeBadge"),
      bundleTierPreset: document.getElementById("bundleTierPreset"),
      bundleMode:     document.getElementById("bundleMode"),
      bundleScopes:   document.getElementById("bundleScopes"),
      bundleStack:    document.getElementById("bundleStack"),
      bundleFiles:    document.getElementById("bundleFiles"),
      instrStatus:    document.getElementById("instrStatus"),
    };

    const MODE_LABELS = {
      "auto": "Auto",
      "design-system": "Diseño de sistema",
      "debugging": "Debugging",
      "new-feature": "Feature nueva",
    };

    function selectedScopes() {
      return Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
    }

    function makeTags(container, items, cssClass) {
      container.innerHTML = "";
      if (!items || !items.length) { container.textContent = "—"; return; }
      for (const item of items) {
        const span = document.createElement("span");
        span.className = "tag " + (cssClass || "");
        span.textContent = item;
        container.appendChild(span);
      }
    }

    function updateBundle(state) {
      const tierLabel = state.tier === "auto" ? "Auto" : "Tier " + state.tier;
      el.bundleTierPreset.textContent = tierLabel + " | " + (state.preset || "—");

      const modeKey = state.resolvedTaskMode || state.taskMode;
      el.bundleMode.textContent = MODE_LABELS[modeKey] || modeKey;

      makeTags(el.bundleScopes, state.scopes, "scope");
      makeTags(el.bundleStack, state.detectedStack && state.detectedStack.length ? state.detectedStack : null, "stack");
      makeTags(el.bundleFiles, state.contextFiles, "file");

      if (state.hasCustomInstructions) {
        el.instrStatus.textContent = "✓ .github/copilot-instructions.md activo";
        el.instrStatus.style.color = "#86efac";
      } else {
        el.instrStatus.textContent = "✗ No encontrado — usa Inicializar sesión gobernada";
        el.instrStatus.style.color = "#fca5a5";
      }
    }

    function setPolicyBadge(policy) {
      el.policyBadge.textContent = "Política: " + policy;
      el.policyBadge.className = "badge " + policy.toLowerCase();
    }

    function setSessionBadge(hasInstr) {
      if (hasInstr) {
        el.sessionBadge.textContent = "Sesión inicializada";
        el.sessionBadge.className = "badge session-ok";
      } else {
        el.sessionBadge.textContent = "Bootstrap requerido";
        el.sessionBadge.className = "badge session-warn";
      }
    }

    function setModeBadge(state) {
      const modeKey = state.resolvedTaskMode || state.taskMode;
      el.modeBadge.textContent = MODE_LABELS[modeKey] || modeKey;
    }

    function payload(command) {
      return {
        command,
        userTask: el.userTask.value,
        tier: el.tier.value,
        preset: el.preset.value,
        scopes: selectedScopes(),
        taskMode: el.taskMode.value,
      };
    }

    function applyState(state) {
      el.tier.value = state.tier;
      el.preset.value = state.preset;
      if (state.taskMode) el.taskMode.value = state.taskMode;
      el.preview.value = state.previewPrompt || "";
      setPolicyBadge(state.policyState || "OK");
      setSessionBadge(state.hasCustomInstructions);
      setModeBadge(state);
      updateBundle(state);

      document.querySelectorAll('input[type="checkbox"]').forEach(box => {
        box.checked = state.scopes.includes(box.value);
      });
    }

    document.getElementById("btnInit").addEventListener("click", () => vscode.postMessage(payload("initSession")));
    document.getElementById("btnGenerate").addEventListener("click", () => vscode.postMessage(payload("generatePreview")));
    document.getElementById("btnCopy").addEventListener("click", () => vscode.postMessage(payload("copyPrompt")));
    document.getElementById("btnPolicy").addEventListener("click", () => vscode.postMessage(payload("runPolicyCheck")));

    window.addEventListener("message", event => {
      const { command, state } = event.data;
      if (command === "stateUpdate") applyState(state);
    });

    applyState(initialState);
  </script>
</body>
</html>`;
  }
}
