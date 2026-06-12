#!/usr/bin/env bun
import { mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const repoRoot = process.cwd();
  const dir = path.join(repoRoot, ".codex", "harness", "telemetry");
  mkdirSync(dir, { recursive: true });
  const event = {
    timestamp: new Date().toISOString(),
    hook: process.argv[2] ?? "unknown",
    cwd: repoRoot,
    payload: parsePayload(Buffer.concat(chunks).toString("utf8")),
  };
  appendFileSync(path.join(dir, "hooks.jsonl"), `${JSON.stringify(event)}\n`);
});

function parsePayload(input) {
  if (!input.trim()) {
    return null;
  }
  try {
    return JSON.parse(input);
  } catch {
    return { raw: input.slice(0, 20000) };
  }
}
