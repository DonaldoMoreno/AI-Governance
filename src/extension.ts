import * as path from "path";
import * as vscode from "vscode";
import { aggregatePolicy, createDiagnosticsCollection, publishDiagnostics, PolicySeverity } from "./diagnostics";
import {
  findMissingGovernanceFiles,
  getGovernanceFileReferences,
  GovernanceScope,
  scaffoldGovernanceTemplates,
} from "./governanceLoader";
import { compileGovernedPrompt, GovernancePreset } from "./promptCompiler";
import { runPolicyCheck } from "./policyChecker";
import { GovernanceStatusBar } from "./ui/statusBar";
import { PromptStudioWebview } from "./ui/promptStudioWebview";
import { resolveTier, GovernanceTier, TierSelection } from "./tierResolver";

interface RuntimeState {
  selectedTier: TierSelection;
  preset: GovernancePreset;
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
    scopes: [...allScopes],
    policy: "OK",
    latestPrompt: "",
    profileSummary: "",
    resolvedTier: "1",
  };

  context.subscriptions.push(diagnostics, statusBar);

  const updateStatusBar = (): void => {
    statusBar.update(state.selectedTier, state.preset, state.policy);
  };

  const resolveEffectiveTier = async (): Promise<GovernanceTier> => {
    if (state.selectedTier !== "auto") {
      state.profileSummary = tierSummary(state.selectedTier);
      state.resolvedTier = state.selectedTier;
      return state.selectedTier;
    }

    const resolved = await resolveTier(workspaceFolder);
    state.profileSummary = `${resolved.profileSummary} (Source: ${sourceLabel(resolved.source)})`;
    state.resolvedTier = resolved.tier;
    return resolved.tier;
  };

  const generatePrompt = async (userTask: string): Promise<{ prompt: string; files: string[] }> => {
    const tier = await resolveEffectiveTier();
    const files = getGovernanceFileReferences(workspaceFolder, tier, state.scopes);

    const prompt = compileGovernedPrompt({
      workspaceFolder,
      tier,
      preset: state.preset,
      scopes: state.scopes,
      governanceFiles: files,
      userTask,
      profileSummary: state.profileSummary,
    });

    state.latestPrompt = prompt;
    return { prompt, files };
  };

  const runPolicy = async (): Promise<void> => {
    const tier = await resolveEffectiveTier();
    const result = await runPolicyCheck(workspaceFolder, tier);
    publishDiagnostics(diagnostics, result.findings);
    state.policy = aggregatePolicy(result.findings);
    updateStatusBar();

    if (result.findings.length === 0) {
      void vscode.window.showInformationMessage("Policy Check completed: no findings.");
      return;
    }

    const denyCount = result.findings.filter((f) => f.severity === "DENY").length;
    const warnCount = result.findings.filter((f) => f.severity === "WARN").length;
    void vscode.window.showWarningMessage(
      `Policy Check completed: ${denyCount} DENY, ${warnCount} WARN. Review the Problems panel.`
    );
  };

  const refreshPromptStudio = async (userTask: string): Promise<void> => {
    const { prompt, files } = await generatePrompt(userTask);
    PromptStudioWebview.createOrShow(
      context,
      {
        onGeneratePreview: async (message) => {
          await syncStateFromWebview(message.tier, message.preset, message.scopes);
          await refreshPromptStudio(message.userTask);
        },
        onCopyPrompt: async (message) => {
          await syncStateFromWebview(message.tier, message.preset, message.scopes);
          const compiled = await generatePrompt(message.userTask);
          await vscode.env.clipboard.writeText(compiled.prompt);
          void vscode.window.showInformationMessage(
            "Governed prompt copied to clipboard. Paste it into Copilot Chat."
          );
          PromptStudioWebview.createOrShow(context, handlers, webviewState(compiled.files, compiled.prompt));
        },
        onRunPolicyCheck: async (message) => {
          await syncStateFromWebview(message.tier, message.preset, message.scopes);
          await runPolicy();
          PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt));
        },
      },
      webviewState(files, prompt)
    );
  };

  const handlers = {
    onGeneratePreview: async (message: {
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
      userTask: string;
    }) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes);
      await refreshPromptStudio(message.userTask);
    },
    onCopyPrompt: async (message: {
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
      userTask: string;
    }) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes);
      const { prompt, files } = await generatePrompt(message.userTask);
      await vscode.env.clipboard.writeText(prompt);
      void vscode.window.showInformationMessage("Governed prompt copied to clipboard. Paste it into Copilot Chat.");
      PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt));
    },
    onRunPolicyCheck: async (message: {
      tier: TierSelection;
      preset: GovernancePreset;
      scopes: GovernanceScope[];
    }) => {
      await syncStateFromWebview(message.tier, message.preset, message.scopes);
      await runPolicy();
      const { prompt, files } = await generatePrompt(state.latestPrompt);
      PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt));
    },
  };

  const webviewState = (contextFiles: string[], previewPrompt: string) => ({
    tier: state.selectedTier,
    preset: state.preset,
    scopes: state.scopes,
    contextFiles: contextFiles.map((filePath) => path.relative(workspaceFolder.uri.fsPath, filePath)),
    previewPrompt,
    policyState: state.policy,
  });

  const syncStateFromWebview = async (
    tier: TierSelection,
    preset: GovernancePreset,
    scopes: GovernanceScope[]
  ): Promise<void> => {
    state.selectedTier = tier;
    state.preset = preset;
    state.scopes = scopes.length ? scopes : [...allScopes];

    await vscode.workspace.getConfiguration("aiGovernance").update("tier", tier, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace
      .getConfiguration("aiGovernance")
      .update("preset", preset, vscode.ConfigurationTarget.Workspace);

    await resolveEffectiveTier();
    updateStatusBar();
  };

  const openPromptStudio = async (): Promise<void> => {
    await ensureGovernanceTemplates(workspaceFolder);
    const { prompt, files } = await generatePrompt(state.latestPrompt);

    PromptStudioWebview.createOrShow(context, handlers, webviewState(files, prompt));
  };

  const setTier = async (): Promise<void> => {
    const selected = await vscode.window.showQuickPick(
      [
        { label: "Auto", value: "auto" as TierSelection },
        { label: "Tier 1", value: "1" as TierSelection },
        { label: "Tier 2", value: "2" as TierSelection },
        { label: "Tier 3", value: "3" as TierSelection },
      ],
      { placeHolder: "Select a governance tier" }
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

  const statusBarAction = async (): Promise<void> => {
    const pick = await vscode.window.showQuickPick(
      [
        { label: "Change Tier", value: "setTier" },
        { label: "Open Prompt Studio", value: "open" },
        { label: "Run Policy Check", value: "policy" },
      ],
      { placeHolder: "Select an action" }
    );

    if (!pick) {
      return;
    }

    if (pick.value === "setTier") {
      await setTier();
    } else if (pick.value === "open") {
      await openPromptStudio();
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
      void vscode.window.showInformationMessage("Governed prompt copied to clipboard. Paste it into Copilot Chat.");
    }),
    vscode.commands.registerCommand("aiGovernance.runPolicyCheck", runPolicy),
    vscode.commands.registerCommand("aiGovernance.setTier", setTier),
    vscode.commands.registerCommand("aiGovernance.statusBarAction", statusBarAction)
  );

  void (async () => {
    await ensureGovernanceTemplates(workspaceFolder);
    await resolveEffectiveTier();
    updateStatusBar();
  })();
}

export function deactivate(): void {
  // No additional resources to release.
}

function tierSummary(tier: GovernanceTier): string {
  if (tier === "1") {
    return "Tier 1: Prototype or small project focused on iteration speed.";
  }
  if (tier === "2") {
    return "Tier 2: Production project with formal quality and security controls.";
  }
  return "Tier 3: Enterprise or critical system with strict controls and auditing.";
}

function sourceLabel(source: "AI_PROJECT_PROFILE.yaml" | "workspace-setting" | "auto-detection"): string {
  if (source === "AI_PROJECT_PROFILE.yaml") {
    return "AI_PROJECT_PROFILE.yaml";
  }
  if (source === "workspace-setting") {
    return "aiGovernance.tier setting";
  }
  return "automatic detection";
}

async function ensureGovernanceTemplates(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
  const missing = findMissingGovernanceFiles(workspaceFolder);
  if (missing.length === 0) {
    return;
  }

  const create = "Create templates";
  const choice = await vscode.window.showInformationMessage(
    "Not all ai-governance files were found. Do you want to generate default templates?",
    create,
    "Later"
  );

  if (choice !== create) {
    return;
  }

  const created = scaffoldGovernanceTemplates(workspaceFolder);
  void vscode.window.showInformationMessage(`Governance templates created: ${created.length} file(s).`);
}
