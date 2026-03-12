# Output Contract — Debugging

Use this contract when the task mode is **Debugging**.

## Response Structure

### 1. Enunciado del Bug Refinado
Clarify the bug: observed behavior, expected behavior, and context.

### 2. Supuestos
List assumptions about the environment, version, or state at the time of the failure.

### 3. Posibles Causas
Ranked list of hypotheses for the root cause.

### 4. Plan de Debug
Step-by-step commands or checks to isolate the cause. Each step must have expected output and stop conditions.

### 5. Causa Raíz Probable
Most likely root cause based on available evidence.

### 6. Corrección Sugerida
Minimal fix with code changes. Include file path and context lines.

### 7. Verificaciones de Regresión
Checks to confirm the fix works and does not introduce regressions.

## Rules
- Never skip the debug plan. Reproducibility is mandatory.
- Log each attempt with: step, expected output, actual output, decision.
- Prefer minimal fixes; do not refactor unrelated code.
- Consult ai-governance/policies/troubleshooting.md for prior incidents if it contains relevant notes.
