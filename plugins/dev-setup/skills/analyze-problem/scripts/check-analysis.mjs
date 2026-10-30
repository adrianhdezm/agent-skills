#!/usr/bin/env node
// Checks docs/<slug>/02-analysis.md before the later phases depend on it.
//
//   node check-analysis.mjs <02-analysis.md> [--against <ref>]
//
// Errors: no "Status: Approved <date>" line; an ID line in a form the scripts cannot read; a duplicate or missing B
// number; a behaviour with no criterion; a criterion filed under the wrong behaviour, or without Given, When and
// Then. Against the committed version of the file (HEAD by default), an ID that disappeared instead of being marked
// _(dropped)_ is an error, and a changed title or criterion is a warning: a change of meaning needs a new number.
// Exit 0: clean · 1: errors · 2: could not run.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parseAnalysis } from "./analysis.mjs";

const args = process.argv.slice(2);
const ai = args.indexOf("--against");
const against = ai === -1 ? "HEAD" : args[ai + 1];
const path = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--against");
if (!path) {
  console.error("usage: check-analysis.mjs <02-analysis.md> [--against <ref>]");
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
const a = parseAnalysis(text);

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
  const old = parseAnalysis(previous);
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
  `\n${count} behaviours · ${criteria} criteria · ${previous === null ? "no committed version to compare" : `IDs compared with ${against}`} · ${errors.length} error(s), ${warnings.length} warning(s)`
);
process.exit(errors.length ? 1 : 0);
