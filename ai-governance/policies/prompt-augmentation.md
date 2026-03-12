# Prompt Augmentation Policy

Goal: Refine the user prompt before solving so that the AI operates on a clear, well-scoped task.

## Refinement Flow

Before producing any solution, apply the following steps **in order**:

1. **Clarify** — Identify vague or ambiguous parts of the prompt. If clarification is needed, state what is unclear and what assumption was made.
2. **Structure** — Decompose complex prompts into discrete, ordered sub-tasks.
3. **Scope Inference** — Infer the relevant code area, module, or service from repository context. Reference specific files when they are identifiable.
4. **Constraint Preservation** — Preserve the original intent exactly. Never add features, business rules, or requirements that are not present in the prompt or the repository.
5. **Refined Task** — Produce a clearly stated *Refined Task* section before any solution content.

## Rules

- Do not assume requirements that are not in the prompt or visible in the repository.
- When the prompt references a file or component, always read it before responding.
- When the prompt is a single word or fewer than 10 characters, explicitly request or assume clarification before proceeding, and document the assumption.
- Scope inference must be grounded in detected files and dependencies — do not invent file paths.
- The *Refined Task* must be the first section of every AI response that solves a coding task.
- If the original prompt is already clear and complete, the Refined Task can restate it verbatim.
