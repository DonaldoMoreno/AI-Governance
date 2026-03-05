import * as path from "path";
import * as vscode from "vscode";
import { GovernanceScope } from "./governanceLoader";
import { GovernanceTier } from "./tierResolver";

export type GovernancePreset = "Fast" | "Safe" | "Strict";

export interface PromptCompileInput {
  workspaceFolder: vscode.WorkspaceFolder;
  tier: GovernanceTier;
  preset: GovernancePreset;
  scopes: GovernanceScope[];
  governanceFiles: string[];
  userTask: string;
  profileSummary: string;
}

function outputContractByTier(tier: GovernanceTier): string {
  if (tier === "1") {
    return [
      "1. Keep the response concise and focused on delivering a functional solution.",
      "2. Include any minimal security risks detected.",
      "3. Propose the immediate next step.",
    ].join("\n");
  }

  if (tier === "2") {
    return [
      "1. Structure the response as: Design, Implementation, Risks, Testing.",
      "2. Explain impact on dependencies and architecture.",
      "3. Include a validation checklist before merge.",
    ].join("\n");
  }

  return [
    "1. Provide a formal response with sections: Decision, Controls, Compliance, Operations.",
    "2. Include mitigations, observability, and operational cost impact.",
    "3. Include assumptions, residual risks, and a rollback strategy.",
  ].join("\n");
}

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
  const relativeFiles = input.governanceFiles.map((filePath) => path.relative(input.workspaceFolder.uri.fsPath, filePath));

  const sections = [
    "ROLE",
    "You are a development assistant that must strictly follow repository governance. Do not ignore rules.",
    "",
    "PROJECT PROFILE",
    input.profileSummary,
    "",
    "ACTIVE GOVERNANCE",
    `Tier: ${input.tier}`,
    `Scopes: ${input.scopes.join(", ")}`,
    `Preset: ${input.preset} (${presetDescription(input.preset)})`,
    "",
    "GOVERNANCE DOCUMENTS",
    "Read and apply these repository files before responding:",
    ...relativeFiles.map((rel) => `- ${rel}`),
    "",
    "OUTPUT CONTRACT",
    outputContractByTier(input.tier),
    "",
    "USER TASK",
    input.userTask.trim() || "No task specified.",
  ];

  return sections.join("\n");
}
