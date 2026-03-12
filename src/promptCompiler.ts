import * as path from "path";
import * as vscode from "vscode";
import { GovernanceScope } from "./governanceLoader";
import { GovernanceTier } from "./tierResolver";
import { ContextBundle } from "./contextBuilder";

export type GovernancePreset = "Fast" | "Safe" | "Strict";

export interface PromptCompileInput {
  workspaceFolder: vscode.WorkspaceFolder;
  tier: GovernanceTier;
  preset: GovernancePreset;
  scopes: GovernanceScope[];
  governanceFiles: string[];
  userTask: string;
  profileSummary: string;
  contextBundle?: ContextBundle;
}

// Always included regardless of active scopes
const ALWAYS_INCLUDE_POLICIES = [
  "ai-governance/policies/prompt-augmentation.md",
  "ai-governance/policies/output-contract.md",
];

function presetDescription(preset: GovernancePreset): string {
  if (preset === "Fast") {
    return "Fast: prioritizes speed with mandatory minimum controls.";
  }
  if (preset === "Safe") {
    return "Safe: balances speed, quality, and security.";
  }
  return "Strict: maximum adherence to governance and validations.";
}

export function compileGovernedPrompt(input: PromptCompileInput): string {
  const relativeFiles = input.governanceFiles.map((filePath) =>
    path.relative(input.workspaceFolder.uri.fsPath, filePath)
  );

  // Merge governance files with always-included policies, deduplicating
  const allRefFiles = Array.from(new Set([...relativeFiles, ...ALWAYS_INCLUDE_POLICIES]));

  // Build CONTEXT SUMMARY lines from the context bundle when available
  const contextLines: string[] = [];
  if (input.contextBundle) {
    const { detectedStack, repoStructure } = input.contextBundle;
    contextLines.push(`Detected stack: ${detectedStack.join(", ")}`);
    const topFiles = repoStructure.slice(0, 15).join(", ");
    if (topFiles) {
      contextLines.push(`Repository root entries: ${topFiles}`);
    }
  }

  const sections = [
    "ROLE",
    "You are GitHub Copilot working in this repository. You must strictly follow all governance rules. Do not ignore them.",
    "",
    "PROJECT PROFILE",
    input.profileSummary,
    `Tier: ${input.tier}`,
    `Preset: ${input.preset} — ${presetDescription(input.preset)}`,
    "",
    "ACTIVE GOVERNANCE",
    `Scopes: ${input.scopes.join(", ")}`,
    "",
    "CONTEXT SUMMARY",
    ...(contextLines.length ? contextLines : ["No additional context captured."]),
    "",
    "GOVERNANCE DOCUMENTS",
    "Read and apply all of the following repository files before responding:",
    ...allRefFiles.map((rel) => `- ${rel}`),
    "",
    "EXECUTION RULE",
    "Before solving the task:",
    "1. Refine the user prompt according to the method defined in ai-governance/policies/prompt-augmentation.md",
    "2. State assumptions if necessary.",
    "3. Execute the task following all governance rules defined in the documents above.",
    "",
    "OUTPUT CONTRACT",
    "Follow the response structure defined in: ai-governance/policies/output-contract.md",
    "",
    "USER TASK",
    input.userTask.trim() || "No task specified.",
  ];

  return sections.join("\n");
}
