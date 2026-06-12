You are running the Codex Deep Code Harness runtime trace workflow.

Target:
{{target}}

Repository root:
{{repoRoot}}

Repo index artifact:
{{indexPath}}

Index summary:

```json
{{indexSummary}}
```

Trace the runtime path related to the target:

1. Identify likely entry points.
2. Follow calls through validation, state, external IO, and error handling.
3. Highlight observability gaps and where logs/metrics should be inspected.
4. If browser, Sentry, GitHub, or docs MCP tools are available, use them only
   when they provide direct evidence.
5. Return only the structured debug report requested by the output schema.
