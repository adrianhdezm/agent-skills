#!/usr/bin/env node
// Checks a design plan JSON against the analysis and the design, and builds the interactive review page from it.
//
//   node build-plan.mjs <plan.json> --analysis <02-analysis.md> --design <03-design.md> [--out <file.html>] [--standalone]
//
// Errors stop the build; warnings do not. The build refuses an analysis that is not approved, a behaviour that no
// level-1 claim covers or that two cover, a behaviour in no slice or in two, a criterion with no test tier or with
// two, and a slice that depends on a later one. --standalone adds the doctype and head that a published Artifact
// gets from its host, so the file also opens straight from disk.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnalysis, live } from "../../analyze-problem/scripts/analysis.mjs";
import { parseDesign } from "./design.mjs";

const args = process.argv.slice(2);
const VALUED = ["--analysis", "--design", "--out"];
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const planPath = args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1]));
const analysisPath = flag("--analysis");
const designPath = flag("--design");
if (!planPath || !analysisPath || !designPath) {
  console.error("usage: build-plan.mjs <plan.json> --analysis <02-analysis.md> --design <03-design.md> [--out <file.html>] [--standalone]");
  process.exit(2);
}
const outPath = flag("--out") ?? join(dirname(planPath), basename(planPath).replace(/\.plan\.json$|\.json$/, "") + ".html");
const standalone = args.includes("--standalone");
const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch (e) {
    console.error(`error: cannot read ${p}: ${e.message}`);
    process.exit(2);
  }
};

const errors = [];
const warnings = [];
let plan;
try {
  plan = JSON.parse(read(planPath));
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
const coveredBy = new Map(); // B -> level-1 claim numbers
const levelOne = []; // { num, slice, covers }

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
      if (!c.slice) errors.push(`${where}: a level-1 claim names the slice that delivers it ("slice": "S1")`);
      for (const b of c.covers ?? []) coveredBy.set(b, [...(coveredBy.get(b) ?? []), num]);
      levelOne.push({ num, slice: c.slice, covers: c.covers ?? [] });
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

// The analysis: approved, and every live behaviour covered by exactly one level-1 claim.
const analysis = parseAnalysis(read(analysisPath));
if (!/^Approved\b/.test(analysis.status ?? "")) {
  errors.push(`analysis: ${analysisPath} does not say "Status: Approved <YYYY-MM-DD>"; finish /analyze-problem first`);
}
const behaviours = live(analysis);
const ids = behaviours.map((b) => b.id);
const dropped = new Set(analysis.behaviours.filter((b) => b.dropped).map((b) => b.id));
if (ids.length === 0) errors.push(`coverage: found no "### B<n>" headings in ${analysisPath}`);
for (const b of ids) {
  const by = coveredBy.get(b) ?? [];
  if (by.length === 0) errors.push(`coverage: ${b} from the analysis is not covered by any level-1 claim`);
  if (by.length > 1) errors.push(`coverage: ${b} is covered by claims ${by.join(" and ")}; a behaviour belongs to one level-1 claim`);
}
for (const b of coveredBy.keys()) {
  if (dropped.has(b)) errors.push(`coverage: ${b} is dropped in the analysis`);
  else if (!ids.includes(b)) errors.push(`coverage: ${b} is not a behaviour in the analysis`);
}

// The design: every behaviour in one slice, every criterion with one test tier, no forward dependencies.
const KNOWN_TIERS = ["unit", "integration", "component", "contract", "end to end", "end-to-end", "e2e", "api", "browser"];
const design = parseDesign(read(designPath));
if (design.slices.length === 0) errors.push(`design: no "### S<n>: … (B1, B2)" headings under "## Slices" in ${designPath}`);
if (!design.base) warnings.push('design: no "Base: <commit>" on the header line; implementation and verification diff against it');
const order = new Map();
const sliceOf = new Map(); // B -> [S]
const tierOf = new Map(); // B1.1 -> [{ slice, tier }]
for (const [i, s] of design.slices.entries()) {
  if (order.has(s.id)) errors.push(`design: ${s.id} is used twice`);
  order.set(s.id, i);
}
for (const s of design.slices) {
  if (s.covers.length === 0) errors.push(`design ${s.id}: list the behaviours it delivers in its heading, "### ${s.id}: … (B1, B2)"`);
  for (const b of s.covers) {
    sliceOf.set(b, [...(sliceOf.get(b) ?? []), s.id]);
    if (dropped.has(b)) errors.push(`design ${s.id}: ${b} is dropped in the analysis`);
    else if (!ids.includes(b)) errors.push(`design ${s.id}: ${b} is not a behaviour in the analysis`);
  }
  if (s.dependsOn === null) warnings.push(`design ${s.id}: no "Depends on:" line`);
  for (const d of s.dependsOn ?? []) {
    if (!order.has(d)) errors.push(`design ${s.id}: depends on ${d}, which is not a slice`);
    else if (order.get(d) >= order.get(s.id)) errors.push(`design ${s.id}: depends on ${d}, which comes after it; reorder the slices`);
  }
  if (s.tests.length === 0) errors.push(`design ${s.id}: no "- Tests: B1.1 unit · B1.2 integration" line`);
  for (const part of s.stray) errors.push(`design ${s.id}: "${part}" on the Tests line is not "<criterion ID> <tier>"`);
  for (const t of s.tests) {
    tierOf.set(t.id, [...(tierOf.get(t.id) ?? []), { slice: s.id, tier: t.tier }]);
    if (!t.tier) errors.push(`design ${s.id}: ${t.id} has no test tier`);
    else if (!KNOWN_TIERS.includes(t.tier)) warnings.push(`design ${s.id}: ${t.id} tier "${t.tier}" is not one of ${KNOWN_TIERS.join(", ")}; fine if the conventions name it`);
    const b = t.id.split(".")[0];
    if (!s.covers.includes(b)) errors.push(`design ${s.id}: tests ${t.id}, but ${b} is not in ${s.id}`);
  }
}
for (const b of ids) {
  const in_ = sliceOf.get(b) ?? [];
  if (in_.length === 0) errors.push(`design: ${b} is in no slice`);
  if (in_.length > 1) errors.push(`design: ${b} is in ${in_.join(" and ")}; every behaviour is in exactly one slice`);
}
const criteria = behaviours.flatMap((b) => b.criteria.map((c) => c.id));
for (const c of criteria) {
  const t = tierOf.get(c) ?? [];
  if (t.length === 0) errors.push(`design: ${c} has no test tier on any slice's Tests line`);
  if (t.length > 1) errors.push(`design: ${c} has a tier in ${t.map((x) => x.slice).join(" and ")}; give it one`);
}
for (const id of tierOf.keys()) if (!criteria.includes(id)) errors.push(`design: ${id} on a Tests line is not a live criterion in the analysis`);

// The plan and the design agree on which slice delivers which behaviour.
for (const c of levelOne) {
  if (!c.slice) continue;
  const s = design.slices.find((x) => x.id === c.slice);
  if (!s) {
    errors.push(`claim ${c.num}: slice ${c.slice} is not in the design`);
    continue;
  }
  for (const b of c.covers) if (!s.covers.includes(b)) errors.push(`claim ${c.num}: covers ${b} in ${c.slice}, but the design puts ${b} in ${(sliceOf.get(b) ?? ["no slice"]).join(", ")}`);
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
