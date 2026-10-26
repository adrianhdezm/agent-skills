#!/usr/bin/env node
// Traces each acceptance criterion of an analysis (B1.1, B1.2, …) to the test files that name it.
//
//   node trace.mjs <02-analysis.md> [--root <repo>]
//
// Prints a markdown table. Exits 1 when a criterion has no test.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const analysisPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--root");
const ri = args.indexOf("--root");
const root = ri === -1 ? process.cwd() : args[ri + 1];
if (!analysisPath) {
  console.error("usage: trace.mjs <02-analysis.md> [--root <repo>]");
  process.exit(2);
}

const criteria = new Map(); // id -> text
let dropped = false;
let last = null; // the criterion an indented continuation line belongs to
for (const line of readFileSync(analysisPath, "utf8").split("\n")) {
  const b = line.match(/^###\s+(B\d+)\b(.*)$/);
  if (b) dropped = /_\(dropped\)_/.test(b[2]);
  const c = line.match(/^\s*-\s+(B\d+\.\d+)\s+(.*)$/);
  if (c) {
    last = dropped ? null : c[1];
    if (last) criteria.set(last, c[2].trim());
  } else if (last && /^\s+\S/.test(line)) {
    criteria.set(last, `${criteria.get(last)} ${line.trim()}`);
  } else {
    last = null;
  }
}
if (criteria.size === 0) {
  console.error(`error: no criteria ("- B1.1 Given …") found in ${analysisPath}`);
  process.exit(2);
}

const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", ".angular", ".wrangler", ".turbo", "docs"]);
const TEST = /(\.|-)(test|spec|e2e)\.[cm]?[jt]sx?$/;
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (TEST.test(e.name)) files.push(p);
  }
})(root);

const hits = new Map(); // id -> Set(file)
const unknown = new Map();
const ID = /(?<![\w.])(B\d+\.\d+)(?![\d.])/g;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(ID)) {
    const target = criteria.has(m[1]) ? hits : unknown;
    if (!target.has(m[1])) target.set(m[1], new Set());
    target.get(m[1]).add(relative(root, f));
  }
}

const cell = (s) => s.replace(/\|/g, "\\|");
console.log("| ID | Criterion | Tests |\n| --- | --- | --- |");
const missing = [];
for (const [id, text] of criteria) {
  const t = hits.get(id);
  if (!t) missing.push(id);
  console.log(`| ${id} | ${cell(text)} | ${t ? [...t].map((f) => "`" + f + "`").join("<br>") : "**none**"} |`);
}
console.log(`\n${criteria.size - missing.length} of ${criteria.size} criteria have a test · ${files.length} test files scanned`);
if (missing.length) console.log(`No test: ${missing.join(", ")}`);
if (unknown.size) console.log(`IDs in tests that the analysis does not have: ${[...unknown.keys()].join(", ")}`);
process.exit(missing.length ? 1 : 0);
