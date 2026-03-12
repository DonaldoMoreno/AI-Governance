# Output Contract Policy

All AI responses to coding tasks must follow this structure. Every section is required unless marked N/A.

## Response Structure

### 1. Refined Task
Restate the task after applying the refinement defined in `ai-governance/policies/prompt-augmentation.md`.
- If the original prompt was clear, restate it verbatim.
- If assumptions were made during refinement, note them here.

### 2. Assumptions
List every assumption made during analysis or implementation.
- Format: bullet list
- If no assumptions were needed, write: _None._

### 3. Implementation Plan
High-level ordered steps describing the approach before any code is written.
- Each step should be a single sentence action.
- Reference relevant files, modules, or components by name.

### 4. Files to Modify
List each file that will be created or changed, with a one-line description of the change.
- Format: `path/to/file.ts` — description of change

### 5. Code Changes
Provide the actual code with diffs or full blocks.
- Always include the file path above each block.
- Always include at least 3 lines of unchanged context before and after any change.
- Prefer diff format (`+`/`-`) for modifications in existing files.
- Use complete file content only for new files.

### 6. Risks or Notes
Surface any risks, edge cases, follow-up actions, or open questions.
- If none, write: _None identified._

## Rules

- Every section must appear in the response. Use _N/A_ or _None_ rather than omitting a section.
- Code changes must not break existing tests or type-check constraints without noting it explicitly.
- Do not add unrequested features, refactors, or dependencies.
- Security-sensitive changes (secrets, auth, payments) must include an explicit security note in section 6.
