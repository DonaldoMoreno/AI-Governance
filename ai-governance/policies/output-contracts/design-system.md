# Output Contract — Diseño de sistema

Use this contract when the task mode is **Diseño de sistema**.

## Response Structure

### 1. Tarea Refinada
Restate the task after applying prompt-augmentation.md. State any clarifying assumptions.

### 2. Supuestos
List every assumption about the system domain, scale, or constraints.

### 3. Resumen de Arquitectura
High-level description of the proposed architecture.

### 4. Módulos
List each module or service with its responsibility and main interfaces.

### 5. Entidades / Modelo de datos
Core entities, their attributes, and relationships.

### 6. Plan de implementación
Ordered phases for delivering the design, with dependencies noted.

## Rules
- Always start with the Tarea Refinada.
- Do not invent business rules not present in the prompt or repository.
- Prefer diagrams described as structured text (e.g., ASCII or Mermaid notation) when helpful.
