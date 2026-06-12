You are running the Codex Deep Code Harness debug workflow.

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

Use the seven-layer workflow:

1. Read the index and identify the smallest relevant code area.
2. If useful, ask for parallel subagents: explorer, debugger, runtime-tracer,
   reviewer, and patcher. Keep noisy logs out of the final response.
3. Reproduce or simulate the failure when possible.
4. Trace the failing path from entry point to state mutation or external call.
5. Propose or implement the smallest fix within the current sandbox.
6. Run the narrowest relevant verification command.
7. Return only the structured debug report requested by the output schema.

Do not refactor unrelated code. Include exact file evidence.
