#!/usr/bin/env node
// Checks a release's review JSON against the spec and the tech plan, and builds the interactive review page from it.
//
//   node build-review.mjs <review.json> --spec <02-spec.md> --plan <03-tech-plan.md> [--release <R2>]
//     [--out <file.html>] [--standalone]
//
// Errors stop the build; warnings do not. The build refuses a spec that is not approved, a behaviour that no
// level-1 claim covers or that two cover, a behaviour in no slice or in two, a criterion with no test tier or with
// two, and a slice that depends on a later one. When the spec has releases, --release names the one this page
// reviews: its level-1 claims cover exactly that release's behaviours, the tech plan's slices cover that release and
// every one before it, and no slice holds a behaviour of a later release or of two releases. S0 is the setup slice
// (scaffold, constraints, CI): it comes first and delivers no behaviour. The tech plan draws its modules as a Mermaid
// classDiagram under "## Modules", and every other slice draws its path as a sequenceDiagram. --standalone adds the
// doctype and head that a published Artifact gets from its host, so the file also opens straight from disk.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpec, live, releaseOf } from "../../specify-idea/scripts/spec.mjs";
import { parseTechPlan } from "./tech-plan.mjs";

const args = process.argv.slice(2);
const VALUED = ["--spec", "--plan", "--out", "--release"];
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const reviewPath = args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1]));
const specPath = flag("--spec");
const planPath = flag("--plan");
const releaseArg = flag("--release");
if (!reviewPath || !specPath || !planPath) {
  console.error("usage: build-review.mjs <review.json> --spec <02-spec.md> --plan <03-tech-plan.md> [--release <R2>] [--out <file.html>] [--standalone]");
  process.exit(2);
}
const outPath = flag("--out") ?? join(dirname(reviewPath), basename(reviewPath).replace(/\.json$/, "") + ".html");
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
let review;
try {
  review = JSON.parse(read(reviewPath));
} catch (e) {
  console.error(`error: ${reviewPath} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;

if (!review.title) errors.push("title: missing");
else if (words(review.title) < 3 || words(review.title) > 7) warnings.push(`title: "${review.title}" has ${words(review.title)} words; use 3 to 7`);
if (!Array.isArray(review.claims) || review.claims.length === 0) errors.push("claims: at least one level-1 claim is required");
if (!Array.isArray(review.scope) || review.scope.length === 0) errors.push("scope: list what is not changing");

const KINDS = ["code", "mock", "list", "diagram"];
const MERMAID = /^\s*(classDiagram|sequenceDiagram|stateDiagram(?:-v2)?|flowchart|graph|erDiagram)\b/;
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
  if (x.kind === "diagram" && !MERMAID.test(x.body ?? "")) errors.push(`${where}: diagram exhibit body is not Mermaid (classDiagram, sequenceDiagram, stateDiagram-v2, …)`);
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
walk(review.claims ?? [], "", 1);
(review.shared ?? []).forEach((c, i) => {
  checkExhibit(c.exhibit, `shared ${i + 1}`, true);
  if (c.decision) checkDecision(c.decision, `shared ${i + 1}`);
});

if (decisionCount > 5) errors.push(`decisions: ${decisionCount}; ask only the 2 to 5 forks that change what gets built`);
else if (decisionCount < 2) warnings.push(`decisions: ${decisionCount}; most plans have 2 to 5 forks`);

// The spec: approved, and every live behaviour covered by exactly one level-1 claim.
const spec = parseSpec(read(specPath));
if (!/^Approved\b/.test(spec.status ?? "")) {
  errors.push(`spec: ${specPath} does not say "Status: Approved <YYYY-MM-DD>"; finish /specify-idea first`);
}
const behaviours = live(spec);
const ids = behaviours.map((b) => b.id);
const dropped = new Set(spec.behaviours.filter((b) => b.dropped).map((b) => b.id));
if (ids.length === 0) errors.push(`coverage: found no "### B<n>" headings in ${specPath}`);

// Releases: the page reviews one; the tech plan holds it and every release before it.
const releaseFor = releaseOf(spec);
const releaseIds = (spec.releases ?? []).map((r) => r.id);
let inReview = ids; // behaviours the level-1 claims cover
let inPlan = ids; // behaviours that must sit in a slice
if (spec.releases && !releaseArg) {
  errors.push(`release: ${specPath} has releases (${releaseIds.join(", ")}); pass --release <R> for the one this page reviews`);
} else if (releaseArg && !spec.releases) {
  errors.push(`release: ${specPath} has no "## Releases" section, so there is no ${releaseArg}`);
} else if (releaseArg) {
  const upTo = releaseIds.indexOf(releaseArg);
  if (upTo === -1) errors.push(`release: ${releaseArg} is not in ${specPath} (${releaseIds.join(", ")})`);
  const planned = new Set(releaseIds.slice(0, upTo + 1));
  inReview = ids.filter((b) => releaseFor.get(b) === releaseArg);
  inPlan = ids.filter((b) => planned.has(releaseFor.get(b)));
}
for (const b of inReview) {
  const by = coveredBy.get(b) ?? [];
  if (by.length === 0) errors.push(`coverage: ${b} from the spec is not covered by any level-1 claim`);
  if (by.length > 1) errors.push(`coverage: ${b} is covered by claims ${by.join(" and ")}; a behaviour belongs to one level-1 claim`);
}
for (const b of coveredBy.keys()) {
  if (dropped.has(b)) errors.push(`coverage: ${b} is dropped in the spec`);
  else if (!ids.includes(b)) errors.push(`coverage: ${b} is not a behaviour in the spec`);
  else if (!inReview.includes(b)) errors.push(`coverage: ${b} ships in ${releaseFor.get(b)}; this page reviews ${releaseArg}`);
}

// The tech plan: every behaviour in one slice, every criterion with one test tier, no forward dependencies.
const KNOWN_TIERS = ["unit", "integration", "component", "contract", "end to end", "end-to-end", "e2e", "api", "browser"];
const techPlan = parseTechPlan(read(planPath));
if (techPlan.slices.length === 0) errors.push(`plan: no "### S<n>: … (B1, B2)" headings under "## Slices" in ${planPath}`);
if (!techPlan.base && !techPlan.slices.some((s) => s.id === "S0")) {
  warnings.push('plan: no "Base: <commit>" on the header line; implementation and verification diff against it');
}
const order = new Map();
const sliceOf = new Map(); // B -> [S]
const tierOf = new Map(); // B1.1 -> [{ slice, tier }]
for (const [i, s] of techPlan.slices.entries()) {
  if (order.has(s.id)) errors.push(`plan: ${s.id} is used twice`);
  order.set(s.id, i);
}
let lastRelease = -1;
for (const [i, s] of techPlan.slices.entries()) {
  const setup = s.id === "S0";
  if (setup) {
    if (i !== 0) errors.push("plan S0: the setup slice comes first");
    if (s.covers.length) errors.push(`plan S0: the setup slice delivers no behaviour; move ${s.covers.join(", ")} to a later slice`);
  } else if (s.covers.length === 0) errors.push(`plan ${s.id}: list the behaviours it delivers in its heading, "### ${s.id}: … (B1, B2)"`);
  for (const b of s.covers) {
    sliceOf.set(b, [...(sliceOf.get(b) ?? []), s.id]);
    if (dropped.has(b)) errors.push(`plan ${s.id}: ${b} is dropped in the spec`);
    else if (!ids.includes(b)) errors.push(`plan ${s.id}: ${b} is not a behaviour in the spec`);
    else if (!inPlan.includes(b)) errors.push(`plan ${s.id}: ${b} ships in ${releaseFor.get(b)}, after ${releaseArg}; plan it with that release`);
  }
  const rels = [...new Set(s.covers.map((b) => releaseFor.get(b)).filter(Boolean))];
  if (rels.length > 1) errors.push(`plan ${s.id}: mixes ${rels.join(" and ")}; a slice ships in one release`);
  else if (rels.length === 1) {
    const at = releaseIds.indexOf(rels[0]);
    if (at < lastRelease) warnings.push(`plan ${s.id}: ships in ${rels[0]} but comes after a slice of ${releaseIds[lastRelease]}; order slices by release`);
    lastRelease = Math.max(lastRelease, at);
  }
  if (s.dependsOn === null) warnings.push(`plan ${s.id}: no "Depends on:" line`);
  for (const d of s.dependsOn ?? []) {
    if (!order.has(d)) errors.push(`plan ${s.id}: depends on ${d}, which is not a slice`);
    else if (order.get(d) >= order.get(s.id)) errors.push(`plan ${s.id}: depends on ${d}, which comes after it; reorder the slices`);
  }
  if (s.tests.length === 0 && !setup) errors.push(`plan ${s.id}: no "- Tests: B1.1 unit · B1.2 integration" line`);
  for (const part of s.stray) errors.push(`plan ${s.id}: "${part}" on the Tests line is not "<criterion ID> <tier>"`);
  for (const t of s.tests) {
    tierOf.set(t.id, [...(tierOf.get(t.id) ?? []), { slice: s.id, tier: t.tier }]);
    if (!t.tier) errors.push(`plan ${s.id}: ${t.id} has no test tier`);
    else if (!KNOWN_TIERS.includes(t.tier)) warnings.push(`plan ${s.id}: ${t.id} tier "${t.tier}" is not one of ${KNOWN_TIERS.join(", ")}; fine if the conventions name it`);
    const b = t.id.split(".")[0];
    if (!s.covers.includes(b)) errors.push(`plan ${s.id}: tests ${t.id}, but ${b} is not in ${s.id}`);
  }
}
for (const b of inPlan) {
  const in_ = sliceOf.get(b) ?? [];
  if (in_.length === 0) errors.push(`plan: ${b} is in no slice`);
  if (in_.length > 1) errors.push(`plan: ${b} is in ${in_.join(" and ")}; every behaviour is in exactly one slice`);
}
const criteria = behaviours.flatMap((b) => b.criteria.map((c) => c.id));
for (const c of criteria) {
  if (!inPlan.includes(c.split(".")[0])) continue;
  const t = tierOf.get(c) ?? [];
  if (t.length === 0) errors.push(`plan: ${c} has no test tier on any slice's Tests line`);
  if (t.length > 1) errors.push(`plan: ${c} has a tier in ${t.map((x) => x.slice).join(" and ")}; give it one`);
}
for (const id of tierOf.keys()) if (!criteria.includes(id)) errors.push(`plan: ${id} on a Tests line is not a live criterion in the spec`);

// Diagrams: the modules as a class diagram, and each slice that delivers behaviour drawn as a sequence diagram.
if (!techPlan.diagrams.some((d) => /^Modules\b/.test(d.section) && d.kind === "classDiagram")) {
  errors.push(`plan: no \`\`\`mermaid classDiagram under "## Modules" in ${planPath}; draw the modules and records and how they depend on each other`);
}
for (const s of techPlan.slices) {
  if (s.id !== "S0" && !s.diagrams.includes("sequenceDiagram")) {
    errors.push(`plan ${s.id}: no \`\`\`mermaid sequenceDiagram; draw the path its behaviours take through the modules, with the failure that matters`);
  }
}

// The page and the tech plan agree on which slice delivers which behaviour.
for (const c of levelOne) {
  if (!c.slice) continue;
  const s = techPlan.slices.find((x) => x.id === c.slice);
  if (!s) {
    errors.push(`claim ${c.num}: slice ${c.slice} is not in the tech plan`);
    continue;
  }
  for (const b of c.covers) if (!s.covers.includes(b)) errors.push(`claim ${c.num}: covers ${b} in ${c.slice}, but the tech plan puts ${b} in ${(sliceOf.get(b) ?? ["no slice"]).join(", ")}`);
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s). Nothing was written.`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "../assets/review-template.html"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// JSON goes into a <script> block: escaping "<" keeps "</script>" in a code exhibit from closing it.
const json = JSON.stringify(review).replace(/</g, "\\u003c");
let page = template.replace("{{TITLE}}", () => esc(review.title)).replace("/*PLAN_JSON*/", () => json);
if (standalone) {
  page =
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' +
    page +
    "\n</body>\n</html>\n";
}
writeFileSync(outPath, page);
console.log(`wrote ${outPath} · ${review.claims.length} claims · ${decisionCount} decisions · ${warnings.length} warning(s)`);
