import * as vscode from "vscode";
import { GovernanceScope } from "../governanceLoader";
import { GovernancePreset } from "../promptCompiler";
import { TierSelection } from "../tierResolver";

type WebviewMessage =
  | {
      command: "generatePreview";
      userTask: string;
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
    }
  | {
      command: "copyPrompt";
      userTask: string;
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
    }
  | {
      command: "runPolicyCheck";
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
    };

export interface PromptStudioState {
  tier: TierSelection;
  preset: GovernancePreset;
  scopes: GovernanceScope[];
  contextFiles: string[];
  previewPrompt: string;
  policyState: "OK" | "WARN" | "DENY";
  detectedStack: string[];
}

export interface PromptStudioHandlers {
  onGeneratePreview: (message: Extract<WebviewMessage, { command: "generatePreview" }>) => Promise<void>;
  onCopyPrompt: (message: Extract<WebviewMessage, { command: "copyPrompt" }>) => Promise<void>;
  onRunPolicyCheck: (message: Extract<WebviewMessage, { command: "runPolicyCheck" }>) => Promise<void>;
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
      {
        enableScripts: true,
      }
    );

    PromptStudioWebview.currentPanel = new PromptStudioWebview(panel, handlers, initialState);
    context.subscriptions.push(panel);
    return PromptStudioWebview.currentPanel;
  }

  public updateState(state: PromptStudioState): void {
    this.panel.webview.postMessage({
      command: "stateUpdate",
      state,
    });
  }

  private getHtml(webview: vscode.Webview, initialState: PromptStudioState): string {
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
      --stack-tag-bg: #0c4a6e;
      --stack-tag-color: #bae6fd;
    }
    body {
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      margin: 0;
      background: radial-gradient(circle at top right, #1e293b 0%, var(--bg) 52%, #020617 100%);
      color: var(--ink);
      padding: 16px;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 10px 24px rgba(2, 6, 23, 0.45);
    }
    h1 { margin: 0 0 10px; font-size: 1.3rem; }
    h2 { margin: 0 0 8px; font-size: 1rem; }
    label { color: var(--muted); }
    textarea, select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px;
      box-sizing: border-box;
      font-size: 0.95rem;
      background: var(--card-elevated);
      color: var(--ink);
    }
    textarea:focus, select:focus {
      outline: 1px solid var(--accent);
      border-color: var(--accent);
    }
    textarea { min-height: 120px; resize: vertical; }
    .scopes {
      display: grid;
      grid-template-columns: repeat(2, minmax(110px, 1fr));
      gap: 6px;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    button {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 8px 12px;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: var(--accent);
      transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
    }
    button.secondary { background: var(--accent-secondary); }
    button.ghost { background: var(--accent-ghost); border-color: var(--border); }
    button:hover { transform: translateY(-1px); opacity: 0.92; }
    ul { margin: 0; padding-left: 18px; }
    .badge {
      display: inline-block;
      border-radius: 999px;
      background: var(--accent-soft);
      color: #dbeafe;
      border: 1px solid #1e40af;
      padding: 4px 10px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .bundle-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.9rem;
    }
    .bundle-label {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag {
      background: var(--stack-tag-bg);
      color: var(--stack-tag-color);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .tag.scope { background: #1e3a5f; color: #93c5fd; }
    .tag.file  { background: #1a2e1c; color: #86efac; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Prompt Studio</h1>
  <div class="badge" id="policyBadge">Política: ${initialState.policyState}</div>
  <div class="grid" style="margin-top: 12px;">

    <section class="card" style="grid-column: 1 / -1;">
      <h2>Editor de Prompt</h2>
      <textarea id="userTask" placeholder="Escribe la tarea para Copilot..."></textarea>
    </section>

    <section class="card">
      <h2>Configuración de Gobernanza</h2>
      <label for="tier">Nivel</label>
      <select id="tier">
        <option value="auto">Auto</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
      <label for="preset" style="margin-top:8px; display:block;">Perfil</label>
      <select id="preset">
        <option value="Fast">Fast</option>
        <option value="Safe">Safe</option>
        <option value="Strict">Strict</option>
      </select>
      <div style="margin-top:10px;">
        <div style="font-weight:600; margin-bottom:6px;">Alcances</div>
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
          <div class="bundle-label">Nivel detectado</div>
          <span id="bundleTier">—</span>
        </div>
        <div>
          <div class="bundle-label">Perfil</div>
          <span id="bundlePreset">—</span>
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
      </div>
    </section>

    <section class="card" style="grid-column: 1 / -1;">
      <h2>Acciones</h2>
      <div class="actions">
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

    const elements = {
      userTask: document.getElementById("userTask"),
      tier: document.getElementById("tier"),
      preset: document.getElementById("preset"),
      preview: document.getElementById("preview"),
      policyBadge: document.getElementById("policyBadge"),
      bundleTier: document.getElementById("bundleTier"),
      bundlePreset: document.getElementById("bundlePreset"),
      bundleScopes: document.getElementById("bundleScopes"),
      bundleStack: document.getElementById("bundleStack"),
      bundleFiles: document.getElementById("bundleFiles"),
    };

    function selectedScopes() {
      return Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map((x) => x.value);
    }

    function makeTags(container, items, cssClass) {
      container.innerHTML = "";
      if (!items || !items.length) {
        container.textContent = "—";
        return;
      }
      for (const item of items) {
        const span = document.createElement("span");
        span.className = "tag " + (cssClass || "");
        span.textContent = item;
        container.appendChild(span);
      }
    }

    function updateBundle(state) {
      elements.bundleTier.textContent = state.tier === "auto" ? "Auto" : "Tier " + state.tier;
      elements.bundlePreset.textContent = state.preset || "—";
      makeTags(elements.bundleScopes, state.scopes, "scope");
      makeTags(elements.bundleStack, state.detectedStack && state.detectedStack.length ? state.detectedStack : ["—"]);
      makeTags(elements.bundleFiles, state.contextFiles, "file");
    }

    function payload(command) {
      return {
        command,
        userTask: elements.userTask.value,
        tier: elements.tier.value,
        preset: elements.preset.value,
        scopes: selectedScopes(),
      };
    }

    function applyState(state) {
      elements.tier.value = state.tier;
      elements.preset.value = state.preset;
      elements.preview.value = state.previewPrompt;
      elements.policyBadge.textContent = "Política: " + state.policyState;
      updateBundle(state);

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((box) => {
        box.checked = state.scopes.includes(box.value);
      });
    }

    document.getElementById("btnGenerate").addEventListener("click", () => {
      vscode.postMessage(payload("generatePreview"));
    });

    document.getElementById("btnCopy").addEventListener("click", () => {
      vscode.postMessage(payload("copyPrompt"));
    });

    document.getElementById("btnPolicy").addEventListener("click", () => {
      vscode.postMessage(payload("runPolicyCheck"));
    });

    window.addEventListener("message", (event) => {
      const { command, state } = event.data;
      if (command === "stateUpdate") {
        applyState(state);
      }
    });

    applyState(initialState);
  </script>
</body>
</html>`;
  }
}
