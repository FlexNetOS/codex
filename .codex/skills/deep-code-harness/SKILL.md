---
name: "deep-code-harness"
description: "Use for deep code understanding, debugging, repo mapping, runtime tracing, structured reviews, or harness-driven Codex exec workflows."
---

# Deep Code Harness

Use this skill when the user asks for deep code understanding, a debugging
harness, root-cause analysis, runtime tracing, structured code review, or a
repeatable Codex-driven investigation.

## Workflow

1. Build or refresh the repo index:

   ```bash
   bun tools/codex-harness/bin/codex-harness.mjs index
   ```

2. Choose the workflow:
   - `map`: architecture and code understanding.
   - `debug`: failure reproduction, root cause, patch, and verification.
   - `trace`: runtime path and observability analysis.
   - `review`: owner-style branch or diff review.

3. For automated runs, use:

   ```bash
   bun tools/codex-harness/bin/codex-harness.mjs run debug --target "<target>"
   ```

4. For interactive Codex work, ask for explicit subagent fanout when useful:
   - `explorer` for read-heavy architecture work.
   - `debugger` for reproduction and root cause.
   - `runtime-tracer` for logs, browser, stack traces, and observability.
   - `reviewer` for correctness/security/test gaps.
   - `patcher` for minimal implementation and regression tests.

5. Keep the parent thread clean. Subagents should return distilled summaries
   with exact file references, not raw command output dumps.

6. Use output schemas under `tools/codex-harness/schemas/` for machine-readable
   artifacts.

## Rules

- Prefer narrow commands and focused evidence.
- Do not refactor unrelated files during debug or patch workflows.
- Run the narrowest relevant tests after code edits.
- Record unresolved assumptions and residual risk in the structured report.
