# Governed Prompt Studio

`Governed Prompt Studio` is a VS Code extension that transforms a governance policy repository into a **Context Engineering + Governance pipeline** for GitHub Copilot — with no direct API integration, no cloud calls, and no external dependencies.

The extension reads your `ai-governance/` files, resolves the correct governance tier and task mode, augments your prompt with policy context, and lets you initialize a governed Copilot session that persists across turns via `.github/copilot-instructions.md`.

---

## Key Features

- **Prompt Studio** webview (dark theme) with:
  - Multi-line user task editor
  - Task mode selector (`Auto / Diseño de sistema / Debugging / Feature nueva`)
  - Tier selector (`Auto / 1 / 2 / 3`) and Preset selector (`Fast / Safe / Strict`)
  - Governance scope checklist (8 scopes)
  - Context Bundle panel: shows resolved tier, task mode, active scopes, detected stack, governance files
  - Session badge: `Bootstrap requerido` / `Sesión inicializada ✓`
  - Buttons: **Inicializar sesión gobernada**, Generar vista previa, Copiar prompt gobernado, Ejecutar policy check
- **Session bootstrap workflow**: one-time init that writes `.github/copilot-instructions.md` and generates a bootstrap prompt — subsequent turns in the same Copilot Chat session can be shorter
- **Task-aware compilation**: three compile paths depending on mode and session state
- **Status bar**: `$(shield) T2 · Debugging | OK` with QuickPick actions
- **Local Policy Checker**: detects secrets, overengineering, and restricted dependencies
- **Governance template scaffolding**: missing `ai-governance/` files are auto-created on first run

---

## Task Modes

| Mode | Alcances por defecto | Output Contract |
|------|---------------------|-----------------|
| **Diseño de sistema** | Architecture, Dependencies, Workflow, Security | `output-contracts/design-system.md` |
| **Debugging** | Troubleshooting, Observability, Workflow | `output-contracts/debugging.md` |
| **Feature nueva** | Architecture, Workflow, Dependencies, Security | `output-contracts/new-feature.md` |

When `Auto` is selected the mode is detected heuristically from your task text (keyword scoring). You can override it with the selector or with the `AI Governance: Establecer modo de tarea` command.

---

## Session Bootstrap Workflow

Governed Prompt Studio supports a two-phase workflow:

### Phase 1 — Initialize once per chat session

1. Open Prompt Studio (`AI Governance: Open Prompt Studio`)
2. Write a brief task or leave it empty
3. Click **Inicializar sesión gobernada**
4. The extension:
   - Creates `.github/copilot-instructions.md` with repository-level governance instructions
   - Creates `.github/prompts/governed-session.prompt.md` (template for re-use)
   - Generates a full bootstrap prompt and copies it to the clipboard
5. Paste the bootstrap prompt into a **new** GitHub Copilot Chat session
6. Copilot responds: `✓ Sesión gobernada inicializada. Modo activo: <mode>. Listo para trabajar…`

From this point on, Copilot already has your governance context loaded. The session badge in Prompt Studio turns green: **Sesión inicializada ✓**.

### Phase 2 — Subsequent turns (shorter prompts)

Once the session is initialized, clicking **Copiar prompt gobernado** generates a compact short prompt:

```
[MODO: Debugging | NIVEL: 2 | PERFIL: Safe]
Archivos: ai-governance/policies/troubleshooting.md, ai-governance/policies/security.md

Mi tarea: el endpoint /api/orders retorna 500 al recibir un payload vacío.
```

Copilot already has the full context from Phase 1, so you don't need to repeat it.

> **Nota**: El comportamiento de Copilot está guiado por `.github/copilot-instructions.md` como contexto, pero no puede garantizarse de forma absoluta en todas las sesiones nuevas de chat.

---

## Prompt Structure

### Full governed prompt (Phase 1 or non-bootstrapped session)

```
== ROLE ==
Eres un asistente de programación experto…

== PROJECT PROFILE ==
Nivel de gobernanza: 2 | Perfil: Safe | Fuente: AI_PROJECT_PROFILE.yaml

== TASK MODE ==
Modo de tarea: Debugging
…

== ACTIVE GOVERNANCE ==
Scopes activos: Troubleshooting, Observability, Workflow, Security

== CONTEXT SUMMARY ==
…

== GOVERNANCE DOCUMENTS ==
### ai-governance/policies/troubleshooting.md
…

== EXECUTION RULE ==
…

== OUTPUT CONTRACT ==
…

== USER TASK ==
…
```

### Short prompt (Phase 2)

```
[MODO: Debugging | NIVEL: 2 | PERFIL: Safe]
Archivos: …

Mi tarea: …
```

### Bootstrap prompt

Full context + session initialization instruction + available task modes + confirmation request.

---

## Project Structure

```text
.
├── .github/
│   ├── copilot-instructions.md        ← repository-level Copilot context (auto-created)
│   ├── prompts/
│   │   └── governed-session.prompt.md ← governed session template
│   └── workflows/build-vsix.yml
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
│       ├── prompt-augmentation.md
│       ├── output-contract.md
│       ├── task-modes.md              ← task mode rules
│       ├── output-contracts/
│       │   ├── design-system.md
│       │   ├── debugging.md
│       │   └── new-feature.md
│       └── dependency-rules.yaml
├── src/
│   ├── extension.ts
│   ├── tierResolver.ts
│   ├── promptCompiler.ts
│   ├── promptAugmentation.ts
│   ├── contextBuilder.ts
│   ├── contextRouter.ts
│   ├── taskModeResolver.ts
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

---

## Command Palette Commands

| Command | Description |
|---------|-------------|
| `AI Governance: Open Prompt Studio` | Open the Prompt Studio webview |
| `AI Governance: Copy Governed Prompt to Clipboard` | Copy the governed prompt directly |
| `AI Governance: Run Policy Check` | Run the local policy checker |
| `AI Governance: Set Tier` | Override the governance tier |
| `AI Governance: Inicializar sesión gobernada` | Bootstrap a new Copilot session |
| `AI Governance: Establecer modo de tarea` | Override the task mode |
| `AI Governance: Crear instrucciones para Copilot` | Scaffold `.github/copilot-instructions.md` |

---

## Tier Resolution Priority

1. `AI_PROJECT_PROFILE.yaml` (repository-level explicit config)
2. `aiGovernance.tier` VS Code setting
3. Auto-detection from repository heuristics (presence of Dockerfile, kubernetes/, CI files, etc.)

---

## Policy Checker

Severity by tier:

| Finding | Tier 1 | Tier 2 | Tier 3 |
|---------|--------|--------|--------|
| Hardcoded secrets | DENY | DENY | DENY |
| Restricted dependencies | WARN | DENY | DENY |
| Overengineering | WARN | WARN | DENY |

Findings are published to the VS Code `Problems` panel.

---

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

Install locally:

```bash
code --install-extension governed-prompt-studio-0.1.0.vsix
```

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `aiGovernance.tier` | `"auto"\|"1"\|"2"\|"3"` | `"auto"` | Governance tier |
| `aiGovernance.preset` | `"Fast"\|"Safe"\|"Strict"` | `"Safe"` | Governance preset |
| `aiGovernance.taskMode` | `"auto"\|"design-system"\|"debugging"\|"new-feature"` | `"auto"` | Active task mode |
