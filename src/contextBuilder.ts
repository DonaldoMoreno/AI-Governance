import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { GovernanceScope } from "./governanceLoader";
import { GovernanceTier } from "./tierResolver";

export interface ContextBundle {
  tier: GovernanceTier;
  preset: string;
  scopes: GovernanceScope[];
  repoStructure: string[];
  detectedStack: string[];
  governanceFiles: string[];
  userPrompt: string;
}

// Manifest files that reveal the technology stack
const MANIFEST_FILES: Array<{ file: string; stack: string }> = [
  { file: "package.json", stack: "Node.js / JavaScript / TypeScript" },
  { file: "pom.xml", stack: "Java / Maven" },
  { file: "build.gradle", stack: "Java / Gradle" },
  { file: "requirements.txt", stack: "Python" },
  { file: "pyproject.toml", stack: "Python" },
  { file: "go.mod", stack: "Go" },
  { file: "Cargo.toml", stack: "Rust" },
  { file: "composer.json", stack: "PHP" },
];

// Framework keywords found in package.json dependencies
const FRAMEWORK_KEYS: Record<string, string> = {
  react: "React",
  vue: "Vue.js",
  "@angular/core": "Angular",
  next: "Next.js",
  nuxt: "Nuxt.js",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  svelte: "Svelte",
  "@remix-run/node": "Remix",
};

function scanTopLevel(root: string): string[] {
  try {
    return fs.readdirSync(root).slice(0, 40);
  } catch {
    return [];
  }
}

function inferStack(root: string): string[] {
  const stack = new Set<string>();

  for (const { file, stack: label } of MANIFEST_FILES) {
    if (fs.existsSync(path.join(root, file))) {
      stack.add(label);
    }
  }

  // Enrich Node.js projects with detected frameworks
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      const allDeps = {
        ...(pkg.dependencies as Record<string, string> | undefined),
        ...(pkg.devDependencies as Record<string, string> | undefined),
      };
      for (const [key, label] of Object.entries(FRAMEWORK_KEYS)) {
        if (Object.prototype.hasOwnProperty.call(allDeps, key)) {
          stack.add(label);
        }
      }
    } catch {
      // ignore malformed package.json
    }
  }

  return stack.size > 0 ? Array.from(stack) : ["Unknown stack"];
}

/**
 * Build a ContextBundle by introspecting the workspace.
 * All discovery is deterministic — no network calls.
 */
export function buildContextBundle(
  workspaceFolder: vscode.WorkspaceFolder,
  tier: GovernanceTier,
  preset: string,
  scopes: GovernanceScope[],
  governanceFiles: string[],
  userPrompt: string
): ContextBundle {
  const root = workspaceFolder.uri.fsPath;

  return {
    tier,
    preset,
    scopes,
    repoStructure: scanTopLevel(root),
    detectedStack: inferStack(root),
    governanceFiles: governanceFiles.map((f) => path.relative(root, f)),
    userPrompt,
  };
}
