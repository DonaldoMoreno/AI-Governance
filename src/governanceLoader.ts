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
  "policies/prompt-augmentation.md",
  "policies/output-contract.md",
  "policies/task-modes.md",
  "policies/output-contracts/design-system.md",
  "policies/output-contracts/debugging.md",
  "policies/output-contracts/new-feature.md",
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
    "policies/prompt-augmentation.md": "# Prompt Augmentation Policy\n\nGoal: Refine the user prompt before solving so that the AI operates on a clear, well-scoped task.\n\n## Refinement Flow\n\n1. **Clarify** — Identify vague or ambiguous parts.\n2. **Structure** — Decompose into discrete sub-tasks when needed.\n3. **Scope Inference** — Infer the relevant code area from repository context.\n4. **Constraint Preservation** — Preserve the original intent; never invent business requirements.\n5. **Refined Task** — Produce a clearly stated Refined Task before the solution.\n\n## Rules\n\n- Do not assume requirements that are not in the prompt or repository.\n- When the prompt references a file, always read it before responding.\n- When the prompt is a single word or very short, ask for clarification before proceeding.\n- Output the Refined Task as the very first section of your response.\n",
    "policies/output-contract.md": "# Output Contract Policy\n\nAll AI responses must follow this structure:\n\n1. **Refined Task** — Restate the task after applying prompt-augmentation.md.\n2. **Assumptions** — List any assumptions made.\n3. **Implementation Plan** — High-level steps to be taken.\n4. **Files to Modify** — List each file and the change summary.\n5. **Code Changes** — Provide the actual code with diffs or full blocks.\n6. **Risks or Notes** — Surface any risks, edge cases, or follow-up actions.\n\n## Rules\n\n- All sections are required unless explicitly not applicable.\n- Mark N/A sections explicitly rather than omitting them.\n- Code changes must include the file path and sufficient context (at least 3 lines before and after).\n- Avoid unexplained assumptions; every assumption must appear in section 2.\n",
    "policies/task-modes.md": "# Task Modes Policy\n\nThis project supports three task modes that change context, scope defaults, and output structure.\n\n## Diseño de sistema\n- Default scopes: Architecture, Dependencies, Workflow, Security\n- Output contract: ai-governance/policies/output-contracts/design-system.md\n- Response must include: Refined Task, Assumptions, Architecture Overview, Modules, Entities / Data Model, Implementation Plan\n\n## Debugging\n- Default scopes: Troubleshooting, Observability, Workflow\n- Output contract: ai-governance/policies/output-contracts/debugging.md\n- Response must include: Refined Bug Statement, Assumptions, Possible Causes, Debug Plan, Likely Root Cause, Suggested Fix, Regression Checks\n\n## Feature nueva\n- Default scopes: Architecture, Workflow, Dependencies, Security\n- Output contract: ai-governance/policies/output-contracts/new-feature.md\n- Response must include: Refined Feature Request, Assumptions, Affected Modules, Design Impact, Implementation Plan, Files to Modify, Risks / Edge Cases\n",
    "policies/output-contracts/design-system.md": "# Output Contract — Diseño de sistema\n\nUse this contract when the task mode is **Diseño de sistema**.\n\n## Response Structure\n\n### 1. Tarea Refinada\nRestate the task after applying prompt-augmentation.md. State any clarifying assumptions.\n\n### 2. Supuestos\nList every assumption about the system domain, scale, or constraints.\n\n### 3. Resumen de Arquitectura\nHigh-level description of the proposed architecture.\n\n### 4. Módulos\nList each module or service with its responsibility and main interfaces.\n\n### 5. Entidades / Modelo de datos\nCore entities, their attributes, and relationships.\n\n### 6. Plan de implementación\nOrdered phases for delivering the design, with dependencies noted.\n\n## Rules\n- Always start with the Tarea Refinada.\n- Do not invent business rules not present in the prompt or repository.\n- Prefer diagrams described as structured text (e.g., ASCII or Mermaid notation) when helpful.\n",
    "policies/output-contracts/debugging.md": "# Output Contract — Debugging\n\nUse this contract when the task mode is **Debugging**.\n\n## Response Structure\n\n### 1. Enunciado del Bug Refinado\nClarify the bug: observed behavior, expected behavior, and context.\n\n### 2. Supuestos\nList assumptions about the environment, version, or state at the time of the failure.\n\n### 3. Posibles Causas\nRanked list of hypotheses for the root cause.\n\n### 4. Plan de Debug\nStep-by-step commands or checks to isolate the cause. Each step must have expected output and stop conditions.\n\n### 5. Causa Raíz Probable\nMost likely root cause based on available evidence.\n\n### 6. Corrección Sugerida\nMinimal fix with code changes. Include file path and context lines.\n\n### 7. Verificaciones de Regresión\nChecks to confirm the fix works and does not introduce regressions.\n\n## Rules\n- Never skip the debug plan. Reproducibility is mandatory.\n- Log each attempt with: step, expected output, actual output, decision.\n- Prefer minimal fixes; do not refactor unrelated code.\n- Consult ai-governance/policies/troubleshooting.md for prior incidents if it contains relevant notes.\n",
    "policies/output-contracts/new-feature.md": "# Output Contract — Feature nueva\n\nUse this contract when the task mode is **Feature nueva**.\n\n## Response Structure\n\n### 1. Solicitud Refinada\nRestate the feature request with clear scope and boundaries.\n\n### 2. Supuestos\nList every assumption about existing code, users, or constraints.\n\n### 3. Módulos Afectados\nList existing modules or components that will be changed or touched.\n\n### 4. Impacto de Diseño\nDescribe the architectural impact: new dependencies, changed interfaces, DB schema changes.\n\n### 5. Plan de Implementación\nOrdered implementation steps.\n\n### 6. Archivos a Modificar\nList each file with a one-line description of the change.\n\n### 7. Riesgos / Casos Extremos\nEdge cases, backwards-compatibility risks, and follow-up actions.\n\n## Rules\n- Scope is limited to what was requested. No additional features.\n- Must explicitly address backwards compatibility.\n- Security-sensitive changes (auth, payments) must include a security note in section 7.\n",
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
