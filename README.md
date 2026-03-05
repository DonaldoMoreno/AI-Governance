# Governed Prompt Studio

`Governed Prompt Studio` is a VS Code extension for creating governed prompts for GitHub Copilot without any direct API integration.

The extension:
- Builds a final prompt with governance structure by `Tier` and `Scope`.
- References repository files (`ai-governance/*`) instead of hardcoding rules.
- Runs a local `Policy Check` and publishes findings to the `Problems` panel.
- Copies the governed prompt to the clipboard so you can paste it into Copilot Chat.

## Key Features

- `Prompt Studio` webview with:
  - Multi-line user task editor.
  - Tier selector (`Auto / 1 / 2 / 3`).
  - Preset selector (`Fast / Safe / Strict`).
  - Governance scope checklist (`Security`, `Architecture`, `Dependencies`, `Workflow`, `Compliance`, `Observability`, `Cost`, `Troubleshooting`).
  - Governance context file preview.
  - Buttons to generate preview, copy prompt, and run policy check.
- Status bar integration:
  - `Tier: <Auto|1|2|3> | Preset: <Fast|Safe|Strict> | Policy: <OK|WARN|DENY>`
  - QuickPick with fast actions.
- Tier resolution priority:
  1. `AI_PROJECT_PROFILE.yaml`
  2. `aiGovernance.tier` setting
  3. Auto-detection from repository heuristics
- Local `Policy Checker` detects:
  - Hardcoded secrets (`API_KEY=`, `SECRET=`, `password=`, `token=`)
  - Overengineering keywords (`kubernetes`, `microservices`, `kafka`, `elasticsearch`, `service mesh`)
  - Restricted dependencies from YAML rules
- Governance template scaffolding when `ai-governance` files are missing.

## Project Structure

```text
.
├── .github/workflows/build-vsix.yml
├── ai-governance/
│   ├── tiers/
│   │   ├── tier1-prototype.md
│   │   ├── tier2-production.md
│   │   └── tier3-enterprise.md
│   └── policies/
│       ├── security.md
│       ├── architecture.md
│       ├── dependencies.md
│       ├── workflow.md
│       ├── compliance.md
│       ├── observability.md
│       ├── cost.md
│       ├── troubleshooting.md
│       └── dependency-rules.yaml
├── src/
│   ├── extension.ts
│   ├── tierResolver.ts
│   ├── promptCompiler.ts
│   ├── policyChecker.ts
│   ├── governanceLoader.ts
│   ├── diagnostics.ts
│   └── ui/
│       ├── statusBar.ts
│       └── promptStudioWebview.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Command Palette Commands

- `AI Governance: Open Prompt Studio`
- `AI Governance: Copy Governed Prompt to Clipboard`
- `AI Governance: Run Policy Check`
- `AI Governance: Set Tier`

## Usage Flow

1. Run `AI Governance: Open Prompt Studio`.
2. Write your task in the prompt editor.
3. Select `Tier`, `Preset`, and `Scopes`.
4. Click `Generate Preview` to preview the governed prompt.
5. Click `Copy Governed Prompt to Clipboard`.
6. Paste the prompt into Copilot Chat.

## Compiled Prompt Structure

The compiler generates these sections:
- `ROLE`
- `PROJECT PROFILE`
- `ACTIVE GOVERNANCE`
- `GOVERNANCE DOCUMENTS`
- `OUTPUT CONTRACT`
- `USER TASK`

## Policy Checker

Severity by tier:
- Tier 1:
  - secrets: `DENY`
  - overengineering: `WARN`
  - restricted dependencies: `WARN`
- Tier 2:
  - secrets: `DENY`
  - restricted dependencies: `DENY`
  - overengineering: `WARN`
- Tier 3:
  - most violations: `DENY`

Findings are published in `Problems`.

## Build and Package

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

Package VSIX:

```bash
npm run package
```

## Install the VSIX Extension

1. Generate the `.vsix` file with `npm run package`.
2. In VS Code, open `Extensions`.
3. Select `Install from VSIX...`.
4. Choose the generated file.

## VSIX CI

Workflow `.github/workflows/build-vsix.yml` runs:
- checkout
- setup node
- npm install
- compile
- vsce package
- upload VSIX artifact
