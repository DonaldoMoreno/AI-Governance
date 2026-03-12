import { GovernanceScope } from "./governanceLoader";

export type TaskMode = "design-system" | "debugging" | "new-feature";

/** Spanish display labels used in the UI. */
export const TASK_MODE_LABELS: Record<TaskMode, string> = {
  "design-system": "Diseño de sistema",
  debugging: "Debugging",
  "new-feature": "Feature nueva",
};

export interface TaskModeConfig {
  mode: TaskMode;
  label: string;
  defaultScopes: GovernanceScope[];
  /** Relative path from workspace root to the task-specific output contract. */
  outputContractFile: string;
  augmentationFocus: string[];
}

export const TASK_MODE_CONFIGS: Record<TaskMode, TaskModeConfig> = {
  "design-system": {
    mode: "design-system",
    label: "Diseño de sistema",
    defaultScopes: ["Architecture", "Dependencies", "Workflow", "Security"],
    outputContractFile: "ai-governance/policies/output-contracts/design-system.md",
    augmentationFocus: [
      "system boundaries",
      "modules",
      "entities",
      "architecture",
      "implementation phases",
    ],
  },
  debugging: {
    mode: "debugging",
    label: "Debugging",
    defaultScopes: ["Troubleshooting", "Observability", "Workflow"],
    outputContractFile: "ai-governance/policies/output-contracts/debugging.md",
    augmentationFocus: [
      "clarify symptoms",
      "isolate failure",
      "identify hypotheses",
      "define debug steps",
      "propose minimal fix",
    ],
  },
  "new-feature": {
    mode: "new-feature",
    label: "Feature nueva",
    defaultScopes: ["Architecture", "Workflow", "Dependencies", "Security"],
    outputContractFile: "ai-governance/policies/output-contracts/new-feature.md",
    augmentationFocus: [
      "feature scope",
      "impact on existing modules",
      "affected files",
      "backwards compatibility",
      "minimal implementation path",
    ],
  },
};

// Keyword banks for heuristic detection
const DESIGN_KEYWORDS = [
  "diseña", "diseño", "arquitectura", "sistema", "esquema", "design",
  "architecture", "structure", "schema", "entidad", "entity", "modelo",
  "model", "diagrama", "diagram", "blueprint",
];

const DEBUG_KEYWORDS = [
  "bug", "error", "falla", "fallo", "incorrecto", "roto", "broken", "crash",
  "exception", "traceback", "no funciona", "no arranca", "debug", "debugging",
  "stacktrace", "reproduce", "síntoma", "sintoma", "flakey", "flaky",
];

const FEATURE_KEYWORDS = [
  "agrega", "añade", "soporte", "nueva funcionalidad", "add", "implement",
  "feature", "nuevo", "nueva", "crea", "create", "integra", "integrate",
  "endpoint", "servicio", "service",
];

/** Heuristic task-mode detection — returns "new-feature" as safe default when uncertain. */
export function detectTaskMode(userPrompt: string): TaskMode {
  const lower = userPrompt.toLowerCase();

  const designScore = DESIGN_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  const debugScore = DEBUG_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  const featureScore = FEATURE_KEYWORDS.filter((kw) => lower.includes(kw)).length;

  const max = Math.max(designScore, debugScore, featureScore);
  if (max === 0) {
    return "new-feature";
  }
  if (debugScore === max) {
    return "debugging";
  }
  if (designScore === max) {
    return "design-system";
  }
  return "new-feature";
}

/**
 * Resolve the effective task mode.
 * User selection takes highest priority; falls back to heuristic when "auto".
 */
export function resolveTaskMode(
  userPrompt: string,
  selectedMode: TaskMode | "auto"
): TaskMode {
  if (selectedMode !== "auto") {
    return selectedMode;
  }
  return detectTaskMode(userPrompt);
}
