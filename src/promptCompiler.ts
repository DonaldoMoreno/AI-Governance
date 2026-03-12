import * as path from "path";
import * as vscode from "vscode";
import { GovernanceScope } from "./governanceLoader";
import { GovernanceTier } from "./tierResolver";
import { ContextBundle } from "./contextBuilder";
import { TaskMode, TASK_MODE_CONFIGS } from "./taskModeResolver";

export type GovernancePreset = "Fast" | "Safe" | "Strict";

export interface PromptCompileInput {
  workspaceFolder: vscode.WorkspaceFolder;
  tier: GovernanceTier;
  preset: GovernancePreset;
  taskMode: TaskMode;
  scopes: GovernanceScope[];
  governanceFiles: string[];
  userTask: string;
  profileSummary: string;
  contextBundle?: ContextBundle;
}

// Always included regardless of active scopes or task mode
const ALWAYS_INCLUDE_POLICIES = [
  "ai-governance/policies/prompt-augmentation.md",
  "ai-governance/policies/output-contract.md",
  ".github/copilot-instructions.md",
];

function presetDescription(preset: GovernancePreset): string {
  if (preset === "Fast") {
    return "prioriza velocidad con controles mínimos obligatorios";
  }
  if (preset === "Safe") {
    return "equilibra velocidad, calidad y seguridad";
  }
  return "máxima adherencia a gobernanza y validaciones";
}

function buildAllRefFiles(input: PromptCompileInput): string[] {
  const relativeFiles = input.governanceFiles.map((filePath) =>
    path.relative(input.workspaceFolder.uri.fsPath, filePath)
  );
  const config = TASK_MODE_CONFIGS[input.taskMode];
  return Array.from(
    new Set([...relativeFiles, ...ALWAYS_INCLUDE_POLICIES, config.outputContractFile])
  );
}

function buildContextLines(input: PromptCompileInput): string[] {
  if (!input.contextBundle) {
    return ["Sin contexto adicional capturado."];
  }
  const { detectedStack, repoStructure, hasCustomInstructions } = input.contextBundle;
  const lines: string[] = [];
  lines.push(`Stack detectado: ${detectedStack.join(", ")}`);
  const top = repoStructure.slice(0, 12).join(", ");
  if (top) {
    lines.push(`Entradas raíz del repositorio: ${top}`);
  }
  if (hasCustomInstructions) {
    lines.push("Instrucciones del repositorio: .github/copilot-instructions.md (activas)");
  }
  return lines;
}

/**
 * Compile the full governed prompt (use when session is NOT bootstrapped).
 */
export function compileGovernedPrompt(input: PromptCompileInput): string {
  const config = TASK_MODE_CONFIGS[input.taskMode];
  const allRefFiles = buildAllRefFiles(input);
  const contextLines = buildContextLines(input);

  return [
    "ROLE",
    "Eres GitHub Copilot trabajando en este repositorio. Debes seguir estrictamente todas las reglas de gobernanza activas. No las ignores.",
    "",
    "PROJECT PROFILE",
    input.profileSummary,
    `Nivel: ${input.tier} | Perfil: ${input.preset} — ${presetDescription(input.preset)}`,
    "",
    "TASK MODE",
    `Modo activo: ${config.label}`,
    `Alcances prioritarios: ${config.defaultScopes.join(", ")}`,
    `Enfoque de refinamiento: ${config.augmentationFocus.join("; ")}`,
    "",
    "ACTIVE GOVERNANCE",
    `Alcances activos: ${input.scopes.join(", ")}`,
    "",
    "CONTEXT SUMMARY",
    ...contextLines,
    "",
    "GOVERNANCE DOCUMENTS",
    "Lee y aplica los siguientes archivos del repositorio antes de responder:",
    ...allRefFiles.map((rel) => `- ${rel}`),
    "",
    "EXECUTION RULE",
    "Antes de resolver la tarea:",
    "1. Refina el prompt del usuario según: ai-governance/policies/prompt-augmentation.md",
    "2. Declara supuestos explícitamente si es necesario.",
    `3. Usa el contrato de salida del modo activo: ${config.outputContractFile}`,
    "4. Ejecuta la tarea siguiendo todas las reglas de gobernanza anteriores.",
    "",
    "OUTPUT CONTRACT",
    `Sigue la estructura definida en: ${config.outputContractFile}`,
    "Si el contrato de modo no aplica completamente, usa: ai-governance/policies/output-contract.md",
    "",
    "USER TASK",
    input.userTask.trim() || "No se especificó tarea.",
  ].join("\n");
}

/**
 * Compile a short task prompt for subsequent turns after session bootstrap.
 * Assumes .github/copilot-instructions.md is already active in Copilot Chat.
 */
export function compileShortPrompt(input: PromptCompileInput): string {
  const config = TASK_MODE_CONFIGS[input.taskMode];
  const relativeFiles = input.governanceFiles.map((f) =>
    path.relative(input.workspaceFolder.uri.fsPath, f)
  );

  return [
    `[MODO: ${config.label} | NIVEL: ${input.tier} | PERFIL: ${input.preset}]`,
    `Alcances: ${input.scopes.join(", ")}`,
    "",
    "Archivos de gobernanza relevantes:",
    `- ai-governance/policies/prompt-augmentation.md`,
    `- ${config.outputContractFile}`,
    ...relativeFiles.map((rel) => `- ${rel}`),
    "",
    "TAREA:",
    input.userTask.trim() || "No se especificó tarea.",
  ].join("\n");
}

/**
 * Compile the one-time session bootstrap prompt.
 * Copy this to Copilot Chat at the start of each governed session.
 */
export function compileBootstrapPrompt(input: PromptCompileInput): string {
  const config = TASK_MODE_CONFIGS[input.taskMode];
  const relFiles = input.governanceFiles.map((f) =>
    path.relative(input.workspaceFolder.uri.fsPath, f)
  );
  const allRefFiles = Array.from(
    new Set([...relFiles, ...ALWAYS_INCLUDE_POLICIES, config.outputContractFile])
  );
  const stackLine = input.contextBundle?.detectedStack.join(", ") ?? "No detectado";

  return [
    "[INICIO DE SESIÓN GOBERNADA]",
    "",
    "Eres GitHub Copilot trabajando en este repositorio.",
    "A partir de este momento, en esta sesión de chat, consulta los archivos de gobernanza del repositorio antes de responder cualquier pregunta de desarrollo.",
    "",
    "PERFIL DEL PROYECTO",
    input.profileSummary,
    `Nivel: ${input.tier} | Perfil: ${input.preset}`,
    `Stack detectado: ${stackLine}`,
    "",
    "INSTRUCCIONES DEL REPOSITORIO",
    "Lee y aplica: .github/copilot-instructions.md",
    "",
    "MODOS DE TAREA DISPONIBLES",
    "- Diseño de sistema → ai-governance/policies/output-contracts/design-system.md",
    "- Debugging        → ai-governance/policies/output-contracts/debugging.md",
    "- Feature nueva    → ai-governance/policies/output-contracts/new-feature.md",
    "",
    `MODO INICIAL: ${config.label}`,
    `Alcances activos: ${input.scopes.join(", ")}`,
    "",
    "ARCHIVOS DE GOBERNANZA",
    "Lee todos los siguientes antes de responder:",
    ...allRefFiles.map((rel) => `- ${rel}`),
    "",
    "POLÍTICA DE REFINAMIENTO DE PROMPT",
    "Lee y aplica: ai-governance/policies/prompt-augmentation.md",
    "",
    "CONTRATO DE SALIDA",
    `Lee y aplica: ${config.outputContractFile}`,
    "",
    "NOTA SOBRE PERSISTENCIA",
    "Estas instrucciones guían tu comportamiento en esta sesión de chat. Consulta los archivos de gobernanza ante cada tarea relevante.",
    "",
    "CONFIRMACIÓN",
    `Cuando entiendas estas instrucciones, responde con: "✓ Sesión gobernada inicializada. Modo activo: ${config.label}. Listo para trabajar con los lineamientos de gobernanza de este repositorio."`,
  ].join("\n");
}


