You are running the Codex Deep Code Harness repo mapping workflow.

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

Build a deep code understanding map:

1. Identify components, entry points, data flow, and boundary modules.
2. Explain how tests and local commands validate behavior.
3. Call out risky files or modules with evidence.
4. Recommend the first five areas a debugger should inspect.
5. Return only the structured repo map requested by the output schema.
