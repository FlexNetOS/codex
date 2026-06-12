#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = findRepoRoot(process.cwd());
const harnessRoot = path.resolve(repoRoot, "tools/codex-harness");
const defaultRunRoot = path.resolve(repoRoot, ".codex/harness/runs");

const workflows = new Map([
  [
    "debug",
    {
      prompt: "debug.md",
      schema: "debug-report.schema.json",
      output: "debug-report.json",
    },
  ],
  [
    "map",
    {
      prompt: "repo-map.md",
      schema: "repo-map.schema.json",
      output: "repo-map-report.json",
    },
  ],
  [
    "review",
    {
      prompt: "review.md",
      schema: "review-report.schema.json",
      output: "review-report.json",
    },
  ],
  [
    "trace",
    {
      prompt: "trace.md",
      schema: "debug-report.schema.json",
      output: "trace-report.json",
    },
  ],
]);

main();

function main() {
  const [command, ...tail] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "index") {
    const args = parseArgs(tail);
    const outDir = resolveOutDir(args);
    mkdirSync(outDir, { recursive: true });
    const index = buildRepoIndex(args.repo ?? args.target ?? repoRoot);
    const file = path.join(outDir, "repo-index.json");
    writeJson(file, index);
    console.log(file);
    return;
  }

  if (command === "schema") {
    const [maybeWorkflow] = tail;
    const schemaName = maybeWorkflow;
    if (!schemaName) fail("schema requires a schema name");
    const filename = schemaName.endsWith(".json")
      ? schemaName
      : `${schemaName}.schema.json`;
    const schemaPath = path.join(harnessRoot, "schemas", filename);
    if (!existsSync(schemaPath)) fail(`unknown schema: ${schemaName}`);
    console.log(schemaPath);
    return;
  }

  if (command === "prompt" || command === "run") {
    const [maybeWorkflow, ...rest] = tail;
    const args = parseArgs(rest);
    const workflowName = maybeWorkflow;
    const workflow = workflows.get(workflowName);
    if (!workflow) fail(`unknown workflow: ${workflowName ?? "<missing>"}`);

    const outDir = resolveOutDir(args);
    mkdirSync(outDir, { recursive: true });
    const index = buildRepoIndex(args.repo ?? repoRoot);
    const indexPath = path.join(outDir, "repo-index.json");
    writeJson(indexPath, index);

    const prompt = renderPrompt(workflow.prompt, {
      target: args.target ?? "the current repository",
      repoRoot,
      indexPath,
      indexSummary: summarizeIndex(index),
    });
    const promptPath = path.join(outDir, `${workflowName}.prompt.md`);
    writeFileSync(promptPath, prompt);

    if (command === "prompt") {
      console.log(promptPath);
      return;
    }

    const schemaPath = path.join(harnessRoot, "schemas", workflow.schema);
    const outputPath = path.join(outDir, workflow.output);
    const eventsPath = path.join(outDir, `${workflowName}.events.jsonl`);
    const codexArgs = [
      "exec",
      "--json",
      "--sandbox",
      args.sandbox ?? "workspace-write",
      "--output-schema",
      schemaPath,
      "-o",
      outputPath,
      readFileSync(promptPath, "utf8"),
    ];

    if (args.model) {
      codexArgs.splice(1, 0, "--model", args.model);
    }

    const result = spawnSync("codex", codexArgs, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    });
    writeFileSync(eventsPath, result.stdout ?? "");
    writeFileSync(
      path.join(outDir, `${workflowName}.stderr.log`),
      result.stderr ?? "",
    );

    if (result.status !== 0) {
      fail(`codex exec failed with status ${result.status}. See ${eventsPath}`);
    }

    console.log(outputPath);
    return;
  }

  fail(`unknown command: ${command}`);
}

function parseArgs(raw) {
  const args = {};
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = raw[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function resolveOutDir(args) {
  if (args.out) {
    return path.resolve(repoRoot, args.out);
  }
  return path.join(
    defaultRunRoot,
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
}

function findRepoRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      fail("not inside a git repository");
    }
    current = parent;
  }
}

function buildRepoIndex(target) {
  const root = path.resolve(target);
  const files = listTrackedFiles(root);
  const fileFacts = files.map((file) => inspectFile(root, file));
  const manifests = fileFacts.filter((file) => isManifest(file.path));
  const tests = inferTestCommands(root, files);
  const risks = inferRisks(fileFacts);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    repo_root: root,
    git: gitFacts(root),
    totals: {
      tracked_files: files.length,
      manifests: manifests.length,
      risky_files: risks.length,
    },
    languages: summarizeLanguages(fileFacts),
    manifests: manifests.map((file) => file.path),
    test_commands: tests,
    risks,
    files: fileFacts,
  };
}

function listTrackedFiles(root) {
  const result = spawnSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim().split("\n").filter(Boolean);
  }
  return walk(root)
    .map((file) => path.relative(root, file))
    .filter((file) => !file.startsWith(".git/"));
}

function walk(dir) {
  const ignored = new Set([
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".direnv",
  ]);
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) {
      continue;
    }
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function inspectFile(root, relativePath) {
  const full = path.join(root, relativePath);
  let size = 0;
  let lines = 0;
  let signals = [];
  try {
    const stat = statSync(full);
    size = stat.size;
    if (size <= 1024 * 1024) {
      const text = readFileSync(full, "utf8");
      lines = text.length ? text.split("\n").length : 0;
      signals = scanSignals(relativePath, text);
    }
  } catch {
    signals = ["unreadable"];
  }
  return {
    path: relativePath,
    ext: path.extname(relativePath),
    language: languageFor(relativePath),
    size_bytes: size,
    lines,
    signals,
  };
}

function scanSignals(file, text) {
  const checks = [
    ["todo", /\bTODO\b|\bFIXME\b/i],
    ["panic-risk", /\bunwrap\(|\bexpect\(|panic!\(/],
    ["unsafe", /\bunsafe\b/],
    ["shell-exec", /\bexec\(|spawnSync|Command::new|child_process/],
    ["network", /\bfetch\(|reqwest|hyper|axios|curl\b/],
    ["auth-secret", /api[_-]?key|secret|token|password/i],
    ["dynamic-code", /\beval\(|new Function\(/],
  ];
  const signals = checks
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  if (text.split("\n").length > 800) {
    signals.push("large-module");
  }
  if (
    /(^|\/)(Cargo\.toml|package\.json|pyproject\.toml|go\.mod|pom\.xml)$/.test(
      file,
    )
  ) {
    signals.push("manifest");
  }
  return signals;
}

function inferRisks(files) {
  return files
    .filter((file) => file.signals.length > 0 || file.lines > 800)
    .map((file) => ({
      path: file.path,
      score: riskScore(file),
      reasons: file.signals,
      lines: file.lines,
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 100);
}

function riskScore(file) {
  let score = 0;
  score += Math.min(5, Math.floor(file.lines / 250));
  for (const signal of file.signals) {
    score +=
      {
        "auth-secret": 5,
        "unsafe": 4,
        "shell-exec": 4,
        "dynamic-code": 4,
        "panic-risk": 3,
        "network": 3,
        "large-module": 2,
        "todo": 1,
        "manifest": 1,
      }[signal] ?? 1;
  }
  return score;
}

function inferTestCommands(root, files) {
  const commands = [];
  if (files.includes("Cargo.toml")) commands.push("cargo test");
  if (files.includes("codex-rs/Cargo.toml"))
    commands.push("cd codex-rs && just test -p <crate>");
  if (files.includes("package.json")) {
    const pkg = readJsonIfExists(path.join(root, "package.json"));
    for (const name of ["test", "lint", "typecheck"]) {
      if (pkg?.scripts?.[name]) commands.push(`bun run ${name}`);
    }
  }
  if (files.includes("pyproject.toml")) commands.push("pytest");
  if (files.includes("go.mod")) commands.push("go test ./...");
  return [...new Set(commands)];
}

function gitFacts(root) {
  return {
    branch: runText("git", ["branch", "--show-current"], root),
    head: runText("git", ["rev-parse", "--short", "HEAD"], root),
    dirty: runText("git", ["status", "--short"], root).length > 0,
  };
}

function summarizeLanguages(files) {
  const byLanguage = new Map();
  for (const file of files) {
    const current = byLanguage.get(file.language) ?? {
      files: 0,
      lines: 0,
      bytes: 0,
    };
    current.files += 1;
    current.lines += file.lines;
    current.bytes += file.size_bytes;
    byLanguage.set(file.language, current);
  }
  return Object.fromEntries(
    [...byLanguage.entries()].sort((a, b) => b[1].bytes - a[1].bytes),
  );
}

function summarizeIndex(index) {
  return JSON.stringify(
    {
      git: index.git,
      totals: index.totals,
      languages: index.languages,
      manifests: index.manifests.slice(0, 40),
      test_commands: index.test_commands,
      top_risks: index.risks.slice(0, 20),
    },
    null,
    2,
  );
}

function renderPrompt(templateName, values) {
  let text = readFileSync(
    path.join(harnessRoot, "prompts", templateName),
    "utf8",
  );
  for (const [key, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  return text;
}

function languageFor(file) {
  const ext = path.extname(file);
  const byExt = {
    ".rs": "Rust",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".java": "Java",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".sh": "Shell",
    ".md": "Markdown",
    ".toml": "TOML",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
  };
  return byExt[ext] ?? "Other";
}

function isManifest(file) {
  return /(^|\/)(Cargo\.toml|package\.json|pyproject\.toml|go\.mod|pom\.xml|build\.gradle|flake\.nix|justfile|Makefile)$/.test(
    file,
  );
}

function readJsonIfExists(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function runText(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function printHelp() {
  console.log(`Usage:
  codex-harness index [--repo PATH] [--out DIR]
  codex-harness prompt <debug|map|review|trace> [--target TEXT] [--repo PATH] [--out DIR]
  codex-harness run <debug|map|review|trace> [--target TEXT] [--repo PATH] [--out DIR] [--model MODEL] [--sandbox MODE]
  codex-harness schema <debug-report|repo-map|review-report>`);
}

function fail(message) {
  console.error(`codex-harness: ${message}`);
  process.exit(1);
}
