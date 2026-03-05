# Troubleshooting Policy

Goal: provide a repeatable troubleshooting process that can be executed by an agent and remembered for future incidents.

- Follow this flow for every incident: Reproduce, Isolate, Hypothesize, Verify, Document.
- Troubleshooting runs should be executable by an agent with explicit commands, expected output, and stop conditions.
- Log every attempt with: issue signature, environment, attempted step, result, and decision.
- Keep a short memory entry for each resolved incident with root cause and final fix to avoid repeating failed paths.
- Before running a new fix, review prior incident notes and reuse proven diagnostic steps when signatures match.
