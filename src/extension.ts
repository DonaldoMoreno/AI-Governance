import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { aggregatePolicy, createDiagnosticsCollection, publishDiagnostics, PolicySeverity } from "./diagnostics";
import {
  findMissingGovernanceFiles,
  getGovernanceFileReferences,
  GovernanceScope,
  scaffoldGovernanceTemplates,
} from "./governanceLoader";
import {
  compileGovernedPrompt,
  compileBootstrapPrompt,
  compileShortPrompt,
  GovernancePreset,
} from "./promptCompiler";
import { runPolicyCheck } from "./policyChecker";
import { GovernanceStatusBar } from "./ui/statusBar";
import { PromptStudioWebview, PromptStudioHandlers } from "./ui/promptStudioWebview";
import { resolveTier, GovernanceTier, TierSelection } from "./tierResolver";
import { buildContextBundle } from "./contextBuilder";
import { augmentScopesForMode } from "./promptAugmentation";
import { TaskMode, TASK_MODE_LABELS, resolveTaskMode } from "./taskModeResolver";

interface RuntimeState {
  selectedTier: TierSelection;
  preset: GovernancePreset;
  taskMode: TaskMode | "auto";
  scopes: GovernanceScope[];
  policy: PolicySeverity;
  latestPrompt: string;
  profileSummary: string;
  resolvedTier: GovernanceTier;
}

const allScopes: GovernanceScope[] = [
  "Security",
  "Architecture",
  "Dependencies",
  "Workflow",
  "Compliance",
  "Observability",
  "Cost",
  "Troubleshooting",
];

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showWarningMessage("AI Governance requires an open workspace.");
    return;
  }

  const diagnostics = createDiagnosticsCollection();
  const statusBar = new GovernanceStatusBar();

  const state: RuntimeState = {
    selectedTier: "auto",
    preset: vscode.workspace.getConfiguration("aiGovernance").get<GovernancePreset>("preset", "Safe"),
    taskMode: vscode.workspace.getConfiguration("aiGovernance").get<TaskMode | "auto">("taskMode", "auto"),
    scopes: [...allScopes],
    policy: "OK",
    latestPrompt: "",
    profileSummary: "",
    resolvedTier: "1",
  };

  context.subscriptions.push(diagnostics, statusBar);

  const hasCustomInstructions = (): boolean => {
    return fs.existsSync(path.join(workspaceFolder.uri.fsPath, ".github", "copilot-instructions.md"));
  };

  const updateStatusBar = (): void => {
    const modeLabel = state.taskMode === "auto" ? "Auto" : TASK_MODE_LABELS[state.taskMode];
    statusBar.update(state.selectedTier, state.preset, state.policy, modeLabel);
  };

  const resolveEffectiveTier = async (): Promise<GovernanceTier> => {
    if (state.selectedTier !== "auto") {
      state.profileSummary = tierSummary(state.selectedTier);
      state.resolvedTier = state.selectedTier;
      return state.selectedTier;
    }

    const resolved = await resolveTier(workspaceFolder);
    state.profileSummary = `${resolved.profileSummary} (Fuente: ${sourceLabel(resolved.source)})`;
    state.resolvedTier = resolved.tier;
    return resolved.tier;
  };

  type PromptType = "normal" | "short" | "bootstrap";

  const generatePrompt = async (
    userTask: string,
    promptType: PromptType = "normal"
  ): Promise<{ prompt: string; files: string[]; detectedStack: string[]; resolvedMode: TaskMode }> => {
    const tier = await resolveEffectiveTier();
    const resolvedMode = resolveTaskMode(userTask, state.taskMode);
    const { augmentedScopes } = augmentScopesForMode(userTask, state.scopes, resolvedMode);
    const files = getGovernanceFileReferences(workspaceFolder, tier, augmentedScopes);

    const contextBundle = buildContextBundle(
      workspaceFolder,
      tier,
      state.preset,
      resolvedMode,
      augmentedScopes,
      files,
      userTask
    );

    const compileInput = {
      workspaceFolder,
      tier,
      preset: state.preset,
      taskMode: resolvedMode,
      scopes: augmentedScopes,
      governanceFiles: files,
      userTask,
      profileSummary: state.profileSummary,
      contextBundle,
    };

    let prompt: string;
    if (promptType === "bootstrap") {
      prompt = compileBootstrapPrompt(compileInput);
    } else if (promptType === "short") {
      prompt = compileShortPrompt(compileInput);
    } else {
      // In normal mode: use short prompt when session is already bootstrapped
      prompt = hasCustomInstructions()
        ? compileShortPrompt(compileInput)
        : compileGovernedPrompt(compileInput);
    }

    state.latestPrompt = prompt;
    return { prompt, files, detectedStack: contextBundle.detectedStack, resolvedMode };
  };

  const runPolicy = async (): Promise<void> => {
    const tier = await resolveEffectiveTier();
    const result = await runPolicyCheck(workspaceFolder, tier, state.latestPrompt);
    publishDiagnostics(diagnostics, result.findings);
    state.policy = aggregatePolicy(result.findings);
    updateStatusBar();

    if (result.findings.length === 0) {
      void vscode.window.showInformationMessage("Policy Check: sin hallazgos.");
      return;
    }

    const denyCount = result.findings.filter((f) => f.severity === "DENY").length;
    const warnCount = result.findings.filter((f) => f.severity === "WARN").length;
    void vscode.window.showWarningMessage(
      `Policy Check: ${denyCount} DENY, ${warnCount} WARN. Revisa el panel de Problemas.`
    );
  };

  // Scaffold .github/copilot-instructions.md and .github/prompts/governed-session.prompt.md
  const scaffoldGithubFiles = (): string[] => {
    const root = workspaceFolder.uri.fsPath;
    const created: string[] = [];

    const instrDir = path.join(root, ".github");
    const instrPath = path.join(instrDir, "copilot-instructions.md");
    if (!fs.existsSync(instrDir)) {
      fs.mkdirSync(instrDir, { recursive: true });
    }
    if (!fs.existsSync(instrPath)) {
      fs.writeFileSync(instrPath, COPILOT_INSTRUCTIONS_TEMPLATE, "utf8");
      created.push(instrPath);
    }

    const promptsDir = path.join(root, ".github", "prompts");
    const sessionPath = path.join(promptsDir, "governed-session.prompt.md");
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }
    if (!fs.existsSync(sessionPath)) {
      fs.writeFileSync(sessionPath, GOVERNED_SESSION_PLACEHOLDER, "utf8");
      created.push(sessionPath);
    }

    return created;
  };

  // Use let so refreshPromptStudio and handlers can mutually reference each other
  let handlers!: PromptStudioHandlers;

  const webviewState = (
    contextFiles: string[],
    previewPrompt: string,
    detectedStack: string[] = [],
    resolvedMode: TaskMode = "new-feature"
  ) => ({
    tier: state.selectedTier,
    preset: state.preset,
    taskMode: state.taskMode,
    resolvedTaskMode: resolvedMode,
    scopes: state.scopes,
    contextFiles: contextFiles.map((f) => path.relative(workspaceFolder.uri.fsPath, f)),
    previewPrompt,
    policyState: state.policy,
    detectedStack,
    hasCustomInstructions: hasCustomInstructions(),
  });

  const refreshPromptStudio = async (
    userTask: string,
    promptType: PromptType = "normal"
  ): Promise<void> => {
    const { prompt, files, detectedStack, resolvedMode } = await generatePrompt(userTask, promptType);
    PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt, detectedStack, resolvedMode));
  };

  const syncStateFromWebview = async (
    tier: TierSelection,
    preset: GovernancePreset,
    scopes: GovernanceScope[],
    taskMode: TaskMode | "auto"
  ): Promise<void> => {
    state.selectedTier = tier;
    state.preset = preset;
    state.scopes = scopes.length ? scopes : [...allScopes];
    state.taskMode = taskMode;

    const cfg = vscode.workspace.getConfiguration("aiGovernance");
    await cfg.update("tier", tier, vscode.ConfigurationTarget.Workspace);
    await cfg.update("preset", preset, vscode.ConfigurationTarget.Workspace);
    await cfg.update("taskMode", taskMode, vscode.ConfigurationTarget.Workspace);
    await resolveEffectiveTier();
    updateStatusBar();
  };

  handlers = {
    onGeneratePreview: async (message) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes, message.taskMode);
      await refreshPromptStudio(message.userTask);
    },
    onCopyPrompt: async (message) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes, message.taskMode);
      const { prompt, files, detectedStack, resolvedMode } = await generatePrompt(message.userTask);
      await vscode.env.clipboard.writeText(prompt);
      void vscode.window.showInformationMessage("Prompt gobernado copiado al portapapeles. Pégalo en Copilot Chat.");
      PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt, detectedStack, resolvedMode));
    },
    onRunPolicyCheck: async (message) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes, message.taskMode);
      await runPolicy();
      const { prompt, files, detectedStack, resolvedMode } = await generatePrompt(state.latestPrompt);
      PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt, detectedStack, resolvedMode));
    },
    onInitSession: async (message) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes, message.taskMode);
      const created = scaffoldGithubFiles();
      if (created.length > 0) {
        void vscode.window.showInformationMessage(
          `Archivos de gobernanza creados: ${created.length} archivo(s).`
        );
      }
      const { prompt, files, detectedStack, resolvedMode } = await generatePrompt(
        message.userTask,
        "bootstrap"
      );
      // Persist the generated bootstrap prompt to governed-session.prompt.md
      const sessionPath = path.join(
        workspaceFolder.uri.fsPath,
        ".github",
        "prompts",
        "governed-session.prompt.md"
      );
      fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
      fs.writeFileSync(sessionPath, `# Sesión Gobernada\n\n${prompt}`, "utf8");

      await vscode.env.clipboard.writeText(prompt);
      void vscode.window.showInformationMessage(
        "Sesión inicializada. El prompt de bootstrap fue copiado al portapapeles. Pégalo en Copilot Chat para comenzar la sesión gobernada."
      );
      PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt, detectedStack, resolvedMode));
    },
  };

  const openPromptStudio = async (): Promise<void> => {
    await ensureGovernanceTemplates(workspaceFolder);
    const { prompt, files, detectedStack, resolvedMode } = await generatePrompt(state.latestPrompt);
    PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt, detectedStack, resolvedMode));
  };

  const initSession = async (): Promise<void> => {
    await ensureGovernanceTemplates(workspaceFolder);
    scaffoldGithubFiles();
    const { prompt } = await generatePrompt(state.latestPrompt, "bootstrap");
    await vscode.env.clipboard.writeText(prompt);
    void vscode.window.showInformationMessage(
      "Sesión inicializada. Pega el prompt de bootstrap en Copilot Chat."
    );
  };

  const setTier = async (): Promise<void> => {
    const selected = await vscode.window.showQuickPick(
      [
        { label: "Auto", value: "auto" as TierSelection },
        { label: "Tier 1", value: "1" as TierSelection },
        { label: "Tier 2", value: "2" as TierSelection },
        { label: "Tier 3", value: "3" as TierSelection },
      ],
      { placeHolder: "Selecciona un nivel de gobernanza" }
    );
    if (!selected) {
      return;
    }
    state.selectedTier = selected.value;
    await vscode.workspace
      .getConfiguration("aiGovernance")
      .update("tier", selected.value, vscode.ConfigurationTarget.Workspace);
    await resolveEffectiveTier();
    updateStatusBar();
  };

  const setTaskMode = async (): Promise<void> => {
    const options = [
      { label: "Auto (detección heurística)", value: "auto" as const },
      { label: "Diseño de sistema", value: "design-system" as TaskMode },
      { label: "Debugging", value: "debugging" as TaskMode },
      { label: "Feature nueva", value: "new-feature" as TaskMode },
    ];
    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: "Selecciona el modo de tarea",
    });
    if (!selected) {
      return;
    }
    state.taskMode = selected.value;
    await vscode.workspace
      .getConfiguration("aiGovernance")
      .update("taskMode", selected.value, vscode.ConfigurationTarget.Workspace);
    updateStatusBar();
  };

  const scaffoldCopilotInstructions = async (): Promise<void> => {
    const root = workspaceFolder.uri.fsPath;
    const created = scaffoldGithubFiles();
    if (created.length > 0) {
      void vscode.window.showInformationMessage(
        `Archivos creados: ${created.map((f) => path.relative(root, f)).join(", ")}`
      );
    } else {
      void vscode.window.showInformationMessage("Los archivos de instrucciones ya existen.");
    }
  };

  const statusBarAction = async (): Promise<void> => {
    const pick = await vscode.window.showQuickPick(
      [
        { label: "Inicializar sesión gobernada", value: "initSession" },
        { label: "Abrir Prompt Studio", value: "open" },
        { label: "Establecer modo de tarea", value: "setTaskMode" },
        { label: "Establecer nivel de gobernanza", value: "setTier" },
        { label: "Ejecutar policy check", value: "policy" },
      ],
      { placeHolder: "Selecciona una acción" }
    );
    if (!pick) {
      return;
    }
    if (pick.value === "initSession") {
      await initSession();
    } else if (pick.value === "open") {
      await openPromptStudio();
    } else if (pick.value === "setTaskMode") {
      await setTaskMode();
    } else if (pick.value === "setTier") {
      await setTier();
    } else {
      await runPolicy();
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("aiGovernance.openPromptStudio", openPromptStudio),
    vscode.commands.registerCommand("aiGovernance.copyGovernedPrompt", async () => {
      await ensureGovernanceTemplates(workspaceFolder);
      const { prompt } = await generatePrompt(state.latestPrompt);
      await vscode.env.clipboard.writeText(prompt);
      void vscode.window.showInformationMessage("Prompt gobernado copiado al portapapeles. Pégalo en Copilot Chat.");
    }),
    vscode.commands.registerCommand("aiGovernance.runPolicyCheck", runPolicy),
    vscode.commands.registerCommand("aiGovernance.setTier", setTier),
    vscode.commands.registerCommand("aiGovernance.setTaskMode", setTaskMode),
    vscode.commands.registerCommand("aiGovernance.initSession", initSession),
    vscode.commands.registerCommand("aiGovernance.scaffoldCopilotInstructions", scaffoldCopilotInstructions),
    vscode.commands.registerCommand("aiGovernance.statusBarAction", statusBarAction)
  );

  void (async () => {
    await ensureGovernanceTemplates(workspaceFolder);
    await resolveEffectiveTier();
    updateStatusBar();
  })();
}

export function deactivate(): void {
  // No cleanup needed.
}

function tierSummary(tier: GovernanceTier): string {
  if (tier === "1") {
    return "Tier 1: Prototipo o proyecto pequeño orientado a velocidad de iteración.";
  }
  if (tier === "2") {
    return "Tier 2: Proyecto de producción con controles formales de calidad y seguridad.";
  }
  return "Tier 3: Sistema empresarial o crítico con controles estrictos y auditoría.";
}

function sourceLabel(source: "AI_PROJECT_PROFILE.yaml" | "workspace-setting" | "auto-detection"): string {
  if (source === "AI_PROJECT_PROFILE.yaml") {
    return "AI_PROJECT_PROFILE.yaml";
  }
  if (source === "workspace-setting") {
    return "ajuste aiGovernance.tier";
  }
  return "detección automática";
}

async function ensureGovernanceTemplates(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
  const missing = findMissingGovernanceFiles(workspaceFolder);
  if (missing.length === 0) {
    return;
  }

  const create = "Crear plantillas";
  const choice = await vscode.window.showInformationMessage(
    "Faltan archivos de ai-governance. ¿Deseas generar las plantillas predeterminadas?",
    create,
    "Después"
  );

  if (choice !== create) {
    return;
  }

  const created = scaffoldGovernanceTemplates(workspaceFolder);
  void vscode.window.showInformationMessage(`Plantillas de gobernanza creadas: ${created.length} archivo(s).`);
}

// ---------------------------------------------------------------------------
// .github scaffold templates
// ---------------------------------------------------------------------------

const COPILOT_INSTRUCTIONS_TEMPLATE = `# AI Governance — Instrucciones del Repositorio para Copilot

Este repositorio utiliza el framework **Governed Prompt Studio** para mantener gobernanza de desarrollo.

## Contexto a consultar antes de responder

Cuando respondas preguntas de desarrollo en este proyecto, consulta los siguientes archivos si existen:

- \`ai-governance/\` — políticas de gobernanza y configuraciones de nivel
- \`AI_PROJECT_PROFILE.yaml\` — nivel, perfil y alcances activos del proyecto (si existe)
- \`ai-governance/policies/prompt-augmentation.md\` — cómo refinar prompts
- \`ai-governance/policies/output-contract.md\` — estructura de respuesta predeterminada
- \`ai-governance/policies/task-modes.md\` — modos de tarea disponibles y sus reglas

## Comportamiento de gobernanza

- Antes de responder una pregunta de código, identifica qué nivel, perfil y modo de tarea aplican.
- Aplica el contrato de salida relevante desde \`ai-governance/policies/output-contracts/\` cuando el modo de tarea es explícito.
- Preserva la arquitectura existente y las convenciones del proyecto detectadas en el repositorio.
- No inventes requisitos de negocio. Declara supuestos de forma explícita.
- Prioriza corrección y seguridad sobre velocidad, salvo que el perfil sea "Fast".

## Modos de tarea

1. **Diseño de sistema** — arquitectura, diseño de sistema, modelado de entidades
2. **Debugging** — aislamiento de bugs, análisis de causa raíz, correcciones mínimas
3. **Feature nueva** — nueva funcionalidad, compatibilidad hacia atrás, implementación mínima

## Nota importante

Estas son lineamientos del proyecto en curso. El comportamiento de Copilot está guiado por este archivo como contexto, pero no puede garantizarse de forma absoluta en todas las sesiones.
`;

const GOVERNED_SESSION_PLACEHOLDER = `# Sesión Gobernada

Este archivo se actualiza automáticamente al usar el comando "Inicializar sesión gobernada" del Governed Prompt Studio.

Para iniciar una sesión gobernada:
1. Usa el comando AI Governance: Inicializar sesión gobernada (o el botón en Prompt Studio)
2. El prompt de bootstrap será copiado al portapapeles
3. Pégalo en GitHub Copilot Chat
4. Copilot confirmará la inicialización de la sesión

Los prompts subsecuentes en la misma sesión de chat serán más cortos, ya que Copilot ya tendrá el contexto de gobernanza activo.
`;

