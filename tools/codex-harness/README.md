# Codex Deep Code Harness

This harness turns Codex into a repeatable code-understanding and debugging
pipeline. It is intentionally separate from `codex-rs` implementation code.

## Seven layers

1. **Repo index**: builds a language, manifest, test-command, risk, and file map.
2. **Codex orchestrator**: runs `codex exec` with JSONL events and schema output.
3. **Subagent profiles**: project-scoped agents for exploration, debugging, review,
   runtime tracing, and patching.
4. **MCP templates**: optional tool mesh configuration for docs, browser, GitHub,
   Sentry, and other external evidence.
5. **Debug pipeline**: prompts and schemas for structured triage, root cause,
   patch, verification, and handoff reports.
6. **Hooks and telemetry**: lifecycle scripts that append local JSONL traces.
7. **Codex skill**: `$deep-code-harness` teaches Codex when and how to use the
   harness.

## Quickstart

From the repository root:

```bash
bun tools/codex-harness/bin/codex-harness.mjs index
bun tools/codex-harness/bin/codex-harness.mjs prompt debug --target "failing CI"
```

To run Codex through the harness:

```bash
bun tools/codex-harness/bin/codex-harness.mjs run debug --target "failing test"
```

Use `bun` for local harness scripts and `bunx` for external package binaries.
For example, run formatter checks with:

```bash
bunx prettier --check tools/codex-harness/**/*.md tools/codex-harness/**/*.mjs tools/codex-harness/**/*.json
```

Generated run artifacts are written under `.codex/harness/runs/` and ignored by
git.

## Commands

- `index`: create `repo-index.json`.
- `prompt <debug|map|review|trace>`: render a prompt with the current repo index.
- `run <debug|map|review|trace>`: run `codex exec --json` with a structured
  output schema.
- `schema <debug-report|repo-map|review-report>`: print a bundled schema path.

Use `--out <dir>` to write artifacts somewhere other than
`.codex/harness/runs/<timestamp>`.
