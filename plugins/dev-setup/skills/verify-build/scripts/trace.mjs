#!/usr/bin/env node
// Traces each acceptance criterion of an analysis (B1.1, B1.2, …) to the tests whose titles name it.
//
//   node trace.mjs <02-analysis.md> [--root <repo>] [--design <03-design.md> --slice <S2[,S3]>]
//
// A test counts when the criterion ID is inside the title string of an it(), test(), describe() or context() call,
// including .only/.skip/.each forms. An ID anywhere else in a test file, such as a comment, is listed as a mention
// and does not count. With --slice, only the criteria of those slices are traced. Prints a markdown table with
// file:line and the title of each test. Exits 1 when a traced criterion has no test, 2 when it cannot run.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAnalysis, live } from "../../analyze-problem/scripts/analysis.mjs";
import { parseDesign } from "../../design-solution/scripts/design.mjs";
import { TEST_FILE } from "../../define-constraints/scripts/test-files.mjs";

const args = process.argv.slice(2);
const VALUED = ["--root", "--design", "--slice"];
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const analysisPath = args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1]));
const root = flag("--root") ?? process.cwd();
const designPath = flag("--design");
const sliceArg = flag("--slice");
const usage = () => {
  console.error("usage: trace.mjs <02-analysis.md> [--root <repo>] [--design <03-design.md> --slice <S2[,S3]>]");
  process.exit(2);
};
if (!analysisPath || (sliceArg && !designPath)) usage();
const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch (e) {
    console.error(`error: cannot read ${p}: ${e.message}`);
    process.exit(2);
  }
};

const analysis = parseAnalysis(read(analysisPath));
const behaviours = live(analysis);
let wanted = null;
if (sliceArg) {
  const design = parseDesign(read(designPath));
  const names = sliceArg.split(",").map((s) => s.trim());
  const slices = names.map((n) => design.slices.find((s) => s.id === n));
  const unknown = names.filter((n, i) => !slices[i]);
  if (unknown.length) {
    console.error(`error: ${unknown.join(", ")} not under "## Slices" in ${designPath}`);
    process.exit(2);
  }
  wanted = new Set(slices.flatMap((s) => s.covers));
}
const criteria = new Map(); // id -> text
for (const b of behaviours) if (!wanted || wanted.has(b.id)) for (const c of b.criteria) criteria.set(c.id, c.text);
const known = new Set(analysis.behaviours.flatMap((b) => b.criteria.map((c) => c.id)));
if (criteria.size === 0) {
  console.error(`error: no criteria ("- B1.1 Given …") found in ${analysisPath}${wanted ? ` for ${sliceArg}` : ""}`);
  process.exit(2);
}

const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", ".angular", ".wrangler", ".turbo", "docs"]);
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (TEST_FILE.test(relative(root, p).split("\\").join("/"))) files.push(p);
  }
})(root);

// it("…"), test.only('…'), describe.each(table)(`…`), context("…")
const TITLE =
  /\b(?:it|test|describe|context)(?:\.\w+)*(?:\s*\((?:[^()]|\([^()]*\))*\))?\s*\(\s*(?:"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\])*)`)/g;
const ID = /(?<![\w.])(B\d+\.\d+)(?![\d.])/g;
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

const hits = new Map(); // id -> [{ file, line, title }]
const mentions = new Map(); // id -> Set(file:line)
const strangers = new Map(); // ids in titles that the analysis does not have, or has dropped
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = relative(root, f);
  const inTitles = new Set();
  for (const m of text.matchAll(TITLE)) {
    const title = m[1] ?? m[2] ?? m[3];
    const line = lineAt(text, m.index);
    for (const id of title.matchAll(ID)) {
      inTitles.add(`${id[1]}@${line}`);
      if (!criteria.has(id[1])) {
        if (!wanted || !known.has(id[1])) strangers.set(id[1], `${rel}:${line}`);
        continue;
      }
      if (!hits.has(id[1])) hits.set(id[1], []);
      hits.get(id[1]).push({ file: rel, line, title: title.replace(/\s+/g, " ").trim() });
    }
  }
  for (const m of text.matchAll(ID)) {
    const line = lineAt(text, m.index);
    if (!criteria.has(m[1]) || inTitles.has(`${m[1]}@${line}`)) continue;
    if (!mentions.has(m[1])) mentions.set(m[1], new Set());
    mentions.get(m[1]).add(`${rel}:${line}`);
  }
}

const cell = (s) => s.replace(/\|/g, "\\|");
console.log("| ID | Criterion | Tests | Count |\n| --- | --- | --- | --- |");
const missing = [];
for (const [id, text] of criteria) {
  const t = hits.get(id) ?? [];
  if (t.length === 0) missing.push(id);
  const tests = t.length ? t.map((x) => `\`${x.file}:${x.line}\` ${cell(x.title)}`).join("<br>") : "**none**";
  console.log(`| ${id} | ${cell(text)} | ${tests} | ${t.length} |`);
}
console.log(`\n${criteria.size - missing.length} of ${criteria.size} criteria have a test${wanted ? ` (${sliceArg})` : ""} · ${files.length} test files scanned`);
if (missing.length) console.log(`No test: ${missing.join(", ")}`);
const untitled = [...mentions].filter(([id]) => missing.includes(id));
if (untitled.length) {
  console.log("Mentioned, but in no test title (does not count):");
  for (const [id, where] of untitled) console.log(`- ${id}: ${[...where].join(", ")}`);
}
if (strangers.size) console.log(`IDs in test titles that the analysis does not have or has dropped: ${[...strangers].map(([id, at]) => `${id} (${at})`).join(", ")}`);
process.exit(missing.length ? 1 : 0);
