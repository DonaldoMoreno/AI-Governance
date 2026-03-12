# AI Governance — Instrucciones del Repositorio para Copilot

Este repositorio utiliza el framework **Governed Prompt Studio** para mantener gobernanza de desarrollo.

## Contexto a consultar antes de responder

Cuando respondas preguntas de desarrollo en este proyecto, consulta los siguientes archivos si existen:

- `ai-governance/` — políticas de gobernanza y configuraciones de nivel
- `AI_PROJECT_PROFILE.yaml` — nivel, perfil y alcances activos del proyecto (si existe)
- `ai-governance/policies/prompt-augmentation.md` — cómo refinar prompts
- `ai-governance/policies/output-contract.md` — estructura de respuesta predeterminada
- `ai-governance/policies/task-modes.md` — modos de tarea disponibles y sus reglas

## Comportamiento de gobernanza

- Antes de responder una pregunta de código, identifica qué nivel, perfil y modo de tarea aplican.
- Aplica el contrato de salida relevante desde `ai-governance/policies/output-contracts/` cuando el modo de tarea es explícito.
- Preserva la arquitectura existente y las convenciones del proyecto detectadas en el repositorio.
- No inventes requisitos de negocio. Declara supuestos de forma explícita.
- Prioriza corrección y seguridad sobre velocidad, salvo que el perfil sea "Fast".

## Modos de tarea

1. **Diseño de sistema** — arquitectura, diseño de sistema, modelado de entidades
2. **Debugging** — aislamiento de bugs, análisis de causa raíz, correcciones mínimas
3. **Feature nueva** — nueva funcionalidad, compatibilidad hacia atrás, implementación mínima

## Nota importante

Estas son lineamientos del proyecto en curso. El comportamiento de Copilot está guiado por este archivo como contexto, pero no puede garantizarse de forma absoluta en todas las sesiones.
