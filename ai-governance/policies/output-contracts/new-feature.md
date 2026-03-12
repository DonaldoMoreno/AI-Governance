# Output Contract — Feature nueva

Use this contract when the task mode is **Feature nueva**.

## Response Structure

### 1. Solicitud Refinada
Restate the feature request with clear scope and boundaries.

### 2. Supuestos
List every assumption about existing code, users, or constraints.

### 3. Módulos Afectados
List existing modules or components that will be changed or touched.

### 4. Impacto de Diseño
Describe the architectural impact: new dependencies, changed interfaces, DB schema changes.

### 5. Plan de Implementación
Ordered implementation steps.

### 6. Archivos a Modificar
List each file with a one-line description of the change.

### 7. Riesgos / Casos Extremos
Edge cases, backwards-compatibility risks, and follow-up actions.

## Rules
- Scope is limited to what was requested. No additional features.
- Must explicitly address backwards compatibility.
- Security-sensitive changes (auth, payments) must include a security note in section 7.
