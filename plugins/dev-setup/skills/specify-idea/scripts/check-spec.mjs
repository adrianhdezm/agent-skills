#!/usr/bin/env node
// Checks docs/<slug>/02-spec.md before the later phases depend on it.
//
//   node check-spec.mjs <02-spec.md> [--against <ref>]
//
// Errors: no "Status: Approved <date>" line; an ID line in a form the scripts cannot read; a duplicate or missing B
// number; a behaviour with no criterion; a criterion filed under the wrong behaviour, or without Given, When and
// Then; a release with no behaviours, a gap in the R numbers, or a live behaviour in no release or in two; no Mermaid
// classDiagram under "## Domain"; no stateDiagram-v2 under "## Lifecycles", one that is not under a "### <Thing>"
// heading, or a transition that cites a behaviour the spec does not have or has dropped. Against the
// committed version of the file (HEAD by default), an ID that disappeared instead of being marked
// _(dropped)_ is an error, and a changed title or criterion is a warning: a change of meaning needs a new number.
// Exit 0: clean · 1: errors · 2: could not run.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parseSpec, classesOf, transitionsOf } from "./spec.mjs";

const args = process.argv.slice(2);
const ai = args.indexOf("--against");
const against = ai === -1 ? "HEAD" : args[ai + 1];
const path = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--against");
if (!path) {
  console.error("usage: check-spec.mjs <02-spec.md> [--against <ref>]");
  process.exit(2);
}
let text;
try {
  text = readFileSync(path, "utf8");
} catch (e) {
  console.error(`error: cannot read ${path}: ${e.message}`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const at = (line, msg) => `line ${line}: ${msg}`;
const a = parseSpec(text);

if (!a.status) errors.push('status: no "Status: Approved <YYYY-MM-DD>" line under the title');
else if (!/^Approved \d{4}-\d{2}-\d{2}\b/.test(a.status)) errors.push(`status: "Status: ${a.status}" is not "Approved <YYYY-MM-DD>"`);
for (const s of a.stray) errors.push(at(s.line, `"${s.text.trim()}" is not read by the scripts: ${s.why}`));
if (a.behaviours.length === 0) errors.push('behaviours: no "### B<n>: …" headings');

const seen = new Map();
for (const b of a.behaviours) {
  if (seen.has(b.id)) errors.push(at(b.line, `${b.id} is used twice (first at line ${seen.get(b.id)})`));
  else seen.set(b.id, b.line);
  if (!b.title) errors.push(at(b.line, `${b.id} has no title`));
  else if (!/[.!?]$/.test(b.title)) warnings.push(at(b.line, `${b.id}: a title is a sentence that can be true or false; end it with a full stop`));
  if (b.dropped) continue;
  if (b.criteria.filter((c) => !c.dropped).length === 0) errors.push(at(b.line, `${b.id} has no acceptance criterion`));
  const ids = new Set();
  for (const c of b.criteria) {
    if (!c.id.startsWith(`${b.id}.`)) errors.push(at(c.line, `${c.id} is filed under ${b.id}`));
    if (ids.has(c.id)) errors.push(at(c.line, `${c.id} is used twice`));
    ids.add(c.id);
    if (c.dropped) continue;
    const words = ["given", "when", "then"].filter((w) => !new RegExp(`\\b${w}\\b`, "i").test(c.text));
    if (words.length) errors.push(at(c.line, `${c.id} has no ${words.join(", ")}: write "Given …, when …, then …"`));
    else {
      const pos = ["given", "when", "then"].map((w) => c.text.toLowerCase().search(new RegExp(`\\b${w}\\b`)));
      if (!(pos[0] < pos[1] && pos[1] < pos[2])) warnings.push(at(c.line, `${c.id}: Given, When and Then are out of order`));
    }
  }
}
const numbers = [...seen.keys()].map((id) => Number(id.slice(1))).sort((x, y) => x - y);
for (let n = 1; n <= (numbers.at(-1) ?? 0); n++) {
  if (!numbers.includes(n)) errors.push(`B${n} is missing: a removed behaviour keeps its heading, marked _(dropped)_`);
}

// Releases: every live behaviour ships in exactly one, and they are numbered R1, R2, … in the order they ship.
if (a.releases === null) {
  warnings.push('releases: no "## Releases" section; the plan treats every behaviour as one release');
} else {
  if (a.releases.length === 0) errors.push('releases: the "## Releases" section has no "- **R1: <name>**: B1, B2 · <goal>" line');
  const inRelease = new Map();
  a.releases.forEach((r, i) => {
    if (r.id !== `R${i + 1}`) errors.push(at(r.line, `${r.id} is release ${i + 1}; number releases R1, R2, … in the order they ship`));
    if (!r.name) errors.push(at(r.line, `${r.id} has no name`));
    if (r.covers.length === 0) errors.push(at(r.line, `${r.id} lists no behaviours`));
    for (const b of r.covers) {
      const beh = seen.has(b) ? a.behaviours.find((x) => x.id === b) : null;
      if (!beh) errors.push(at(r.line, `${r.id} lists ${b}, which is not a behaviour`));
      else if (beh.dropped) errors.push(at(r.line, `${r.id} lists ${b}, which is dropped`));
      if (inRelease.has(b)) errors.push(at(r.line, `${b} is in ${inRelease.get(b)} and ${r.id}; a behaviour ships in one release`));
      else inRelease.set(b, r.id);
    }
  });
  for (const b of a.behaviours) if (!b.dropped && !inRelease.has(b.id)) errors.push(at(b.line, `${b.id} is in no release`));
}

// Diagrams: the domain as a class diagram, and each thing whose state changes as a statechart whose transitions cite
// the behaviours that make them.
const KNOWN_DIAGRAMS = ["classDiagram", "stateDiagram-v2", "stateDiagram", "sequenceDiagram", "flowchart", "graph"];
for (const d of a.diagrams) {
  if (!KNOWN_DIAGRAMS.includes(d.kind)) errors.push(at(d.line, `mermaid block starts with "${d.kind || "(nothing)"}", not one of ${KNOWN_DIAGRAMS.join(", ")}`));
}
const domain = a.diagrams.filter((d) => /^Domain\b/.test(d.section) && d.kind === "classDiagram");
const classes = new Set(domain.flatMap((d) => [...classesOf(d.body)].map((c) => c.toLowerCase())));
if (domain.length === 0) errors.push('domain: no ```mermaid classDiagram under "## Domain"; draw the things the system knows and how they relate');
else if (classes.size === 0) errors.push(at(domain[0].line, "domain: the classDiagram declares no classes"));
const lifecycles = a.diagrams.filter((d) => /^Lifecycles\b/.test(d.section) && /^stateDiagram/.test(d.kind));
if (lifecycles.length === 0) errors.push('lifecycles: no ```mermaid stateDiagram-v2 under "## Lifecycles"; draw one for each thing whose state changes');
const liveIds = new Set(a.behaviours.filter((b) => !b.dropped).map((b) => b.id));
const droppedIds = new Set(a.behaviours.filter((b) => b.dropped).map((b) => b.id));
for (const d of lifecycles) {
  if (!d.heading) {
    errors.push(at(d.line, 'lifecycles: a statechart sits under the "### <Thing>" heading it draws'));
    continue;
  }
  if (classes.size && !classes.has(d.heading.replace(/\s+/g, "").toLowerCase())) {
    warnings.push(at(d.line, `lifecycles: "${d.heading}" is not a class in the Domain diagram`));
  }
  const moves = transitionsOf(d.body);
  if (moves.length === 0) errors.push(at(d.line, `lifecycles: ${d.heading} has no "a --> b : <event> (B<n>)" transition`));
  for (const t of moves) {
    const where = at(d.line + 1 + t.offset, `${d.heading}: ${t.from} --> ${t.to}`);
    if (t.cites.length === 0 && t.to !== "[*]") warnings.push(`${where} cites no behaviour; label it "<event> (B<n>)"`);
    for (const id of t.cites) {
      if (droppedIds.has(id)) errors.push(`${where} cites ${id}, which is dropped`);
      else if (!liveIds.has(id)) errors.push(`${where} cites ${id}, which is not a behaviour`);
    }
  }
}

// Stable IDs, against the committed version of this file.
let previous = null;
try {
  previous = execFileSync("git", ["-C", dirname(path), "show", `${against}:./${basename(path)}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
} catch {
  /* not committed yet, or not a git repository: nothing to compare */
}
if (previous !== null) {
  const old = parseSpec(previous);
  const now = new Map(a.behaviours.map((b) => [b.id, b]));
  for (const ob of old.behaviours) {
    const nb = now.get(ob.id);
    if (!nb) {
      errors.push(`${ob.id} was removed since ${against}: keep its heading and mark it _(dropped)_`);
      continue;
    }
    if (!ob.dropped && !nb.dropped && ob.title !== nb.title) {
      warnings.push(`${ob.id}'s title changed since ${against} (was "${ob.title}"): a new meaning needs a new number`);
    }
    const crit = new Map(nb.criteria.map((c) => [c.id, c]));
    for (const oc of ob.criteria) {
      const nc = crit.get(oc.id);
      if (!nc && !nb.dropped) errors.push(`${oc.id} was removed since ${against}: keep it and mark it _(dropped)_`);
      else if (nc && !oc.dropped && !nc.dropped && oc.text !== nc.text) {
        warnings.push(`${oc.id} changed since ${against}: if its meaning changed, drop it and add a new number`);
      }
    }
  }
}

const count = a.behaviours.filter((b) => !b.dropped).length;
const criteria = a.behaviours.filter((b) => !b.dropped).reduce((n, b) => n + b.criteria.filter((c) => !c.dropped).length, 0);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(
  `\n${count} behaviours · ${criteria} criteria · ${a.releases?.length ?? 0} releases · ${domain.length} class and ${lifecycles.length} state diagram(s) · ${previous === null ? "no committed version to compare" : `IDs compared with ${against}`} · ${errors.length} error(s), ${warnings.length} warning(s)`
);
process.exit(errors.length ? 1 : 0);
