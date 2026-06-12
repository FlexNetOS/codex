You are running the Codex Deep Code Harness review workflow.

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

Review the current change set as an owner. Prioritize correctness, security,
behavior regressions, concurrency, migration risk, and missing tests. Findings
must include concrete file and line references. If no findings exist, return an
empty findings array and call out test gaps or residual risk.

Return only the structured review report requested by the output schema.
