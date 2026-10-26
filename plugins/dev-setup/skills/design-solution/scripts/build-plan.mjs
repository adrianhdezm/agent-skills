#!/usr/bin/env node
// Checks a design plan JSON and builds the interactive review page from it.
//
//   node build-plan.mjs <plan.json> [--analysis <02-analysis.md>] [--out <file.html>] [--standalone]
//
// Errors stop the build; warnings do not. --standalone adds the doctype and head that a
// published Artifact gets from its host, so the file also opens straight from disk.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const planPath = args.find((a, i) => !a.startsWith("--") && !["--analysis", "--out"].includes(args[i - 1]));
if (!planPath) {
  console.error("usage: build-plan.mjs <plan.json> [--analysis <02-analysis.md>] [--out <file.html>] [--standalone]");
  process.exit(2);
}
const analysisPath = flag("--analysis");
const outPath = flag("--out") ?? join(dirname(planPath), basename(planPath).replace(/\.plan\.json$|\.json$/, "") + ".html");
const standalone = args.includes("--standalone");

const errors = [];
const warnings = [];
let plan;
try {
  plan = JSON.parse(readFileSync(planPath, "utf8"));
} catch (e) {
  console.error(`error: ${planPath} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;

if (!plan.title) errors.push("title: missing");
else if (words(plan.title) < 3 || words(plan.title) > 7) warnings.push(`title: "${plan.title}" has ${words(plan.title)} words; use 3 to 7`);
if (!Array.isArray(plan.claims) || plan.claims.length === 0) errors.push("claims: at least one level-1 claim is required");
if (!Array.isArray(plan.scope) || plan.scope.length === 0) errors.push("scope: list what is not changing");

const KINDS = ["code", "mock", "list"];
const decisionIds = new Set();
let decisionCount = 0;
const covered = new Set();

function checkExhibit(x, where, required) {
  if (!x) {
    if (required) errors.push(`${where}: needs one exhibit`);
    return;
  }
  if (!KINDS.includes(x.kind)) errors.push(`${where}: exhibit kind "${x.kind}" is not one of ${KINDS.join(", ")}`);
  if (x.kind === "code" && !x.body) errors.push(`${where}: code exhibit has no body`);
  if (x.kind === "mock" && !x.html) errors.push(`${where}: mock exhibit has no html`);
  if (x.kind === "list" && !(x.items && x.items.length)) errors.push(`${where}: list exhibit has no items`);
}

function checkDecision(d, where) {
  decisionCount++;
  if (!d.id || !/^[a-z0-9-]+$/.test(d.id)) errors.push(`${where}: decision id must be kebab-case`);
  else if (decisionIds.has(d.id)) errors.push(`${where}: decision id "${d.id}" is used twice`);
  decisionIds.add(d.id);
  if (!d.question) errors.push(`${where}: decision has no question`);
  if (!Array.isArray(d.options) || d.options.length < 2) errors.push(`${where}: decision needs at least 2 options`);
  else if (!d.options.some((o) => o.value === d.default)) errors.push(`${where}: decision default "${d.default}" is not an option value`);
  for (const o of d.options ?? []) if (o.note && words(o.note) > 12) warnings.push(`${where}: option "${o.label}" note is over 12 words`);
}

function walk(list, prefix, level) {
  if (list.length > 5) errors.push(`${prefix || "top"}: ${list.length} children; at most 5`);
  list.forEach((c, i) => {
    const num = prefix ? `${prefix}.${i + 1}` : String(i + 1);
    const where = `claim ${num}`;
    if (level > 3) errors.push(`${where}: deeper than 3 levels`);
    if (!c.text) errors.push(`${where}: no text`);
    if (level < 3 && words(c.text) > 14) warnings.push(`${where}: claim is ${words(c.text)} words; keep it near 12`);
    if (level < 3 && c.text && !/[.!?]$/.test(c.text.trim())) warnings.push(`${where}: a claim is a sentence; end it with a full stop`);
    if (level === 3 && !c.at) warnings.push(`${where}: a level-3 claim names a place; set "at" to path:line`);
    checkExhibit(c.exhibit, where, level < 3);
    if (c.decision) checkDecision(c.decision, where);
    if (level === 1) {
      if (!c.covers || c.covers.length === 0) errors.push(`${where}: a level-1 claim lists the behaviours it covers ("covers": ["B1"])`);
      for (const b of c.covers ?? []) covered.add(b);
    }
    if (c.children) walk(c.children, num, level + 1);
  });
}
walk(plan.claims ?? [], "", 1);
(plan.shared ?? []).forEach((c, i) => {
  checkExhibit(c.exhibit, `shared ${i + 1}`, true);
  if (c.decision) checkDecision(c.decision, `shared ${i + 1}`);
});

if (decisionCount > 5) errors.push(`decisions: ${decisionCount}; ask only the 2 to 5 forks that change what gets built`);
else if (decisionCount < 2) warnings.push(`decisions: ${decisionCount}; most plans have 2 to 5 forks`);

if (analysisPath) {
  const text = readFileSync(analysisPath, "utf8");
  const ids = [];
  for (const m of text.matchAll(/^###\s+(B\d+)\b(.*)$/gm)) if (!/_\(dropped\)_/.test(m[2])) ids.push(m[1]);
  for (const b of ids) if (!covered.has(b)) errors.push(`coverage: ${b} from the analysis is not covered by any level-1 claim`);
  for (const b of covered) if (!ids.includes(b)) errors.push(`coverage: ${b} is not a behaviour in the analysis`);
  if (ids.length === 0) warnings.push(`coverage: found no "### B<n>" headings in ${analysisPath}`);
} else {
  warnings.push("coverage: not checked; pass --analysis docs/<slug>/02-analysis.md");
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s). Nothing was written.`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "../assets/plan-template.html"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// JSON goes into a <script> block: escaping "<" keeps "</script>" in a code exhibit from closing it.
const json = JSON.stringify(plan).replace(/</g, "\\u003c");
let page = template.replace("{{TITLE}}", () => esc(plan.title)).replace("/*PLAN_JSON*/", () => json);
if (standalone) {
  page =
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' +
    page +
    "\n</body>\n</html>\n";
}
writeFileSync(outPath, page);
console.log(`wrote ${outPath} · ${plan.claims.length} claims · ${decisionCount} decisions · ${warnings.length} warning(s)`);
