import { GovernanceScope } from "./governanceLoader";
import { TaskMode, TASK_MODE_CONFIGS } from "./taskModeResolver";

// Each entry maps keyword signals to the scopes they activate
const KEYWORD_SCOPE_MAP: Array<{ keywords: string[]; scopes: GovernanceScope[] }> = [
  {
    keywords: ["auth", "authentication", "login", "oauth", "jwt", "session", "password", "credentials", "sso", "2fa", "mfa"],
    scopes: ["Security"],
  },
  {
    keywords: ["payment", "billing", "invoice", "stripe", "credit card", "checkout", "transaction", "pci"],
    scopes: ["Security", "Compliance"],
  },
  {
    keywords: ["deploy", "deployment", "release", "ci/cd", "pipeline", "kubernetes", "docker", "k8s", "helm", "infra", "infrastructure"],
    scopes: ["Observability", "Cost"],
  },
  {
    keywords: ["refactor", "restructure", "migrate", "reorganize", "rewrite", "redesign"],
    scopes: ["Architecture"],
  },
  {
    keywords: ["debug", "traceback", "error", "exception", "crash", "fix", "bug", "issue", "broken", "failure", "falla", "fallo"],
    scopes: ["Troubleshooting"],
  },
  {
    keywords: ["log", "logging", "trace", "metric", "monitor", "alert", "dashboard", "observability"],
    scopes: ["Observability"],
  },
  {
    keywords: ["compliance", "gdpr", "hipaa", "pci", "regulation", "audit", "sox", "iso27001"],
    scopes: ["Compliance"],
  },
  {
    keywords: ["cost", "budget", "optimize", "reduce cost", "spend", "savings", "pricing"],
    scopes: ["Cost"],
  },
  {
    keywords: ["dependency", "package", "npm", "library", "import", "module", "upgrade", "version"],
    scopes: ["Dependencies"],
  },
];

export interface AugmentationResult {
  augmentedScopes: GovernanceScope[];
  addedScopes: GovernanceScope[];
}

/**
 * Deterministically expand the active scopes by inspecting the user prompt for
 * known keyword signals.  No AI calls — pure string matching.
 */
export function augmentScopes(
  userPrompt: string,
  existingScopes: GovernanceScope[]
): AugmentationResult {
  const lower = userPrompt.toLowerCase();
  const active = new Set<GovernanceScope>(existingScopes);
  const added: GovernanceScope[] = [];

  for (const { keywords, scopes } of KEYWORD_SCOPE_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      for (const scope of scopes) {
        if (!active.has(scope)) {
          active.add(scope);
          added.push(scope);
        }
      }
    }
  }

  return { augmentedScopes: Array.from(active), addedScopes: added };
}

/**
 * Augment scopes starting from the union of existing scopes and the task mode
 * default scopes, then further expand via keyword detection.
 */
export function augmentScopesForMode(
  userPrompt: string,
  existingScopes: GovernanceScope[],
  taskMode: TaskMode
): AugmentationResult {
  const modeDefaults = TASK_MODE_CONFIGS[taskMode].defaultScopes;
  const merged = Array.from(new Set<GovernanceScope>([...existingScopes, ...modeDefaults]));
  return augmentScopes(userPrompt, merged);
}

