import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { GovernanceTier } from "./tierResolver";

export type GovernanceScope =
  | "Security"
  | "Architecture"
  | "Dependencies"
  | "Workflow"
  | "Compliance"
  | "Observability"
  | "Cost"
  | "Troubleshooting";

const scopePolicyMap: Record<GovernanceScope, string> = {
  Security: "security.md",
  Architecture: "architecture.md",
  Dependencies: "dependencies.md",
  Workflow: "workflow.md",
  Compliance: "compliance.md",
  Observability: "observability.md",
  Cost: "cost.md",
  Troubleshooting: "troubleshooting.md",
};

const requiredFiles = [
  "tiers/tier1-prototype.md",
  "tiers/tier2-production.md",
  "tiers/tier3-enterprise.md",
  "policies/security.md",
  "policies/architecture.md",
  "policies/dependencies.md",
  "policies/workflow.md",
  "policies/compliance.md",
  "policies/observability.md",
  "policies/cost.md",
  "policies/troubleshooting.md",
  "policies/dependency-rules.yaml",
];

function governanceRoot(workspaceFolder: vscode.WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, "ai-governance");
}

function tierFileName(tier: GovernanceTier): string {
  if (tier === "1") {
    return "tier1-prototype.md";
  }
  if (tier === "2") {
    return "tier2-production.md";
  }
  return "tier3-enterprise.md";
}

export function getGovernanceFileReferences(
  workspaceFolder: vscode.WorkspaceFolder,
  tier: GovernanceTier,
  scopes: GovernanceScope[]
): string[] {
  const root = governanceRoot(workspaceFolder);
  const files: string[] = [path.join(root, "tiers", tierFileName(tier))];

  for (const scope of scopes) {
    files.push(path.join(root, "policies", scopePolicyMap[scope]));
  }

  return files.filter((filePath) => fs.existsSync(filePath));
}

export function findMissingGovernanceFiles(workspaceFolder: vscode.WorkspaceFolder): string[] {
  const root = governanceRoot(workspaceFolder);
  return requiredFiles
    .map((rel) => path.join(root, rel))
    .filter((absolutePath) => !fs.existsSync(absolutePath));
}

function ensureParentDir(filePath: string): void {
  const parent = path.dirname(filePath);
  fs.mkdirSync(parent, { recursive: true });
}

function defaultTemplateByPath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/");

  const templates: Record<string, string> = {
    "tiers/tier1-prototype.md": "# Tier 1 - Prototype\n\n- Prioritize speed and simplicity.\n- Avoid unnecessary overengineering.\n- Maintain minimum security standards.\n",
    "tiers/tier2-production.md": "# Tier 2 - Production\n\n- Require automated tests for critical changes.\n- Require dependency controls and architecture reviews.\n- Security and stability are mandatory.\n",
    "tiers/tier3-enterprise.md": "# Tier 3 - Enterprise\n\n- Require traceability, auditing, and hardening.\n- Enforce strict security, compliance, and cost controls.\n- High-impact changes must include a rollback plan.\n",
    "policies/security.md": "# Security Policy\n\n- Never expose secrets in source code.\n- Apply least-privilege access principles.\n- Validate inputs and sanitize outputs.\n",
    "policies/architecture.md": "# Architecture Policy\n\n- Choose architecture proportional to problem size.\n- Avoid unnecessary operational complexity.\n- Document relevant technical decisions.\n",
    "policies/dependencies.md": "# Dependency Policy\n\n- Prefer maintained dependencies with compatible licenses.\n- Review vulnerabilities before release.\n- Avoid duplicate libraries for the same objective.\n",
    "policies/workflow.md": "# Workflow Policy\n\n- Keep changes small and reviewable.\n- Include business context in each PR.\n- Run basic checks before merge.\n",
    "policies/compliance.md": "# Compliance Policy\n\n- Record decisions that impact compliance.\n- Do not store sensitive data without protection.\n- Follow applicable internal and external regulations.\n",
    "policies/observability.md": "# Observability Policy\n\n- Define useful logs for diagnostics.\n- Include minimum health metrics for critical components.\n- Avoid logging sensitive information.\n",
    "policies/cost.md": "# Cost Policy\n\n- Justify technologies with high operational cost.\n- Optimize resources for expected load.\n- Prefer low-cost solutions for early prototypes.\n",
    "policies/troubleshooting.md": "# Troubleshooting Policy\n\n- Use a deterministic troubleshooting flow: Reproduce, Isolate, Hypothesize, Verify, Document.\n- Prefer executing troubleshooting with an agent using explicit step-by-step commands and expected outcomes.\n- Persist findings as short notes (issue signature, root cause, fix, and failed attempts) so future runs avoid repeating steps.\n- Before trying a new fix, review prior troubleshooting notes and reference links to previous incidents.\n",
    "policies/dependency-rules.yaml": "deny:\n  \"2\":\n    - left-pad\n  \"3\":\n    - left-pad\n    - request\nwarn:\n  \"1\":\n    - request\n",
  };

  return templates[normalized] ?? "# Governance Document\n\nPending definition of specific rules.\n";
}

export function scaffoldGovernanceTemplates(workspaceFolder: vscode.WorkspaceFolder): string[] {
  const root = governanceRoot(workspaceFolder);
  const created: string[] = [];

  for (const relPath of requiredFiles) {
    const absolutePath = path.join(root, relPath);
    if (!fs.existsSync(absolutePath)) {
      ensureParentDir(absolutePath);
      fs.writeFileSync(absolutePath, defaultTemplateByPath(relPath), "utf8");
      created.push(absolutePath);
    }
  }

  return created;
}
