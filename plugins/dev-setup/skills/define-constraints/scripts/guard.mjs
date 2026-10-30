#!/usr/bin/env node
// Scans the changes since a base commit for a lowered quality bar: new suppressions, skipped or focused tests,
// removed assertions, deleted test files, stubs, and any edit to CONSTRAINTS.md.
//
//   node guard.mjs [--base <ref>]
//
// Run it from the repository root. In an initiative, pass the Base commit from docs/<slug>/03-design.md. Without
// --base, the base is the merge base with origin/main, main or master, which on a repo that works on main is HEAD
// itself, so committed work would not be scanned: the guard says so when that happens.
// Uncommitted and untracked files count as changes. Exit 0: clean · 1: findings · 2: could not run.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { TEST_FILE as TEST } from "./test-files.mjs";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
const bail = (msg) => {
  console.error(`guard: ${msg}`);
  process.exit(2);
};

let base = bi === -1 ? undefined : args[bi + 1];
if (!base) {
  for (const ref of ["origin/main", "main", "master"]) {
    try {
      base = git("merge-base", "HEAD", ref).trim();
      break;
    } catch {
      /* try the next one */
    }
  }
}
if (!base) bail("no base found; pass --base <ref>");
const guessed = bi === -1;
try {
  git("rev-parse", "--verify", `${base}^{commit}`);
} catch {
  bail(`"${base}" is not a commit`);
}

const SKIP = /(^|\/)(node_modules|dist|build|coverage|\.wrangler|\.angular)\/|(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/;
const CODE = /\.([cm]?[jt]sx?|py|go|rs|java|kt|rb|php|cs|swift|vue|svelte)$/;

const SUPPRESSION =
  /@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|istanbul ignore|c8 ignore|v8 ignore|#\s*noqa|#\s*type:\s*ignore|nosemgrep|gitleaks:allow|Stryker disable|NOLINT|@SuppressWarnings/;
const FOCUS_OR_SKIP = /\b(it|test|describe|context)\.(skip|only|todo)\b|\bx(it|test|describe)\s*\(|\bf(it|describe)\s*\(|@pytest\.mark\.skip|t\.Skip\(/;
const STUB = /throw new Error\(\s*["'`](not implemented|todo|unimplemented)|raise NotImplementedError|unimplemented!\(|todo!\(|catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:]*:\s*pass\b/i;
const ASSERTION = /\bexpect\s*\(|\bassert\w*\s*[.(]|\.should\b|\bt\.(Error|Fatal)/;

const findings = [];
const add = (file, line, kind, text) => findings.push({ file, line, kind, text: text.trim().slice(0, 120) });

// Committed and uncommitted changes against the base, then untracked files as wholly added.
const diff = git("diff", "--unified=0", "--no-color", "--find-renames", base);
const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
const removedAssertions = new Map();
const addedAssertions = new Map();
const bump = (m, f) => m.set(f, (m.get(f) ?? 0) + 1);

function scanAdded(file, lineNo, text) {
  if (SKIP.test(file) || !CODE.test(file)) return;
  if (SUPPRESSION.test(text)) add(file, lineNo, "suppression", text);
  if (TEST.test(file) && FOCUS_OR_SKIP.test(text)) add(file, lineNo, "skipped or focused test", text);
  if (STUB.test(text)) add(file, lineNo, "stub or swallowed error", text);
  if (TEST.test(file) && ASSERTION.test(text)) bump(addedAssertions, file);
}

let file = null;
let lineNo = 0;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) {
    file = line === "+++ /dev/null" ? null : line.slice(6);
    continue;
  }
  if (line.startsWith("--- ")) continue;
  const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (hunk) {
    lineNo = Number(hunk[1]);
    continue;
  }
  // A deleted file has no "+++ b/" side; deleted test files are reported from --name-status below.
  if (!file) continue;
  if (line.startsWith("+")) {
    if (/(^|\/)CONSTRAINTS\.md$/.test(file)) add(file, lineNo, "constraints changed", line.slice(1));
    scanAdded(file, lineNo, line.slice(1));
    lineNo++;
  } else if (line.startsWith("-")) {
    if (/(^|\/)CONSTRAINTS\.md$/.test(file)) add(file, lineNo, "constraints changed", `removed: ${line.slice(1)}`);
    if (TEST.test(file) && ASSERTION.test(line)) bump(removedAssertions, file);
  }
}

for (const f of untracked) {
  if (/(^|\/)CONSTRAINTS\.md$/.test(f)) add(f, 0, "constraints changed", "new, untracked file");
  if (SKIP.test(f) || !CODE.test(f)) continue;
  readFileSync(f, "utf8")
    .split("\n")
    .forEach((text, i) => scanAdded(f, i + 1, text));
}

for (const entry of git("diff", "--name-status", "--no-renames", base).split("\n")) {
  const [status, path] = entry.split("\t");
  if (status === "D" && path && TEST.test(path) && !SKIP.test(path)) add(path, 0, "test file deleted", path);
}
for (const [f, removed] of removedAssertions) {
  const added = addedAssertions.get(f) ?? 0;
  if (removed > added) add(f, 0, "assertions removed", `${removed} assertion lines removed, ${added} added`);
}

if (guessed && git("rev-parse", "HEAD").trim() === git("rev-parse", `${base}^{commit}`).trim()) {
  console.log("guard: the base is HEAD itself, so only uncommitted changes are scanned; pass --base <commit work started from>");
}
if (findings.length === 0) {
  console.log(`guard: clean since ${base.slice(0, 7)}`);
  process.exit(0);
}
console.log(`guard: ${findings.length} finding(s) since ${base.slice(0, 7)}\n`);
for (const f of findings) console.log(`${f.file}${f.line ? `:${f.line}` : ""}  ${f.kind}  ${f.text}`);
console.log("\nEach one needs a reason the user accepts, or a fix. Never weaken CONSTRAINTS.md to make a change pass.");
process.exit(1);
