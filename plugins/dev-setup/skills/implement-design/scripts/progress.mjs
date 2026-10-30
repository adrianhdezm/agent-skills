#!/usr/bin/env node
// Reports where an initiative stands, from the files in docs/<slug>/.
//
//   node progress.mjs <docs/<slug>> [--slice <S2 | fixes>]
//
// Prints the Status line of each phase file, then each slice of the design with its state in 04-progress.md, then
// what to build next: the open "Fixes from verification" section first, then the first slice not done.
// Errors: a section marked done with an unticked item, a section whose state is not "done" or "in progress", or a
// section in the progress file that is not a slice of the design. With --slice, also exits 1 when that section has
// an unticked item, so a slice cannot be closed with work left on it. Exit 0: clean · 1: errors · 2: could not run.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDesign } from "../../design-solution/scripts/design.mjs";

const args = process.argv.slice(2);
const si = args.indexOf("--slice");
const only = si === -1 ? null : args[si + 1];
const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--slice");
if (!dir || (si !== -1 && !only)) {
  console.error("usage: progress.mjs <docs/<slug>> [--slice <S2 | fixes>]");
  process.exit(2);
}
if (!existsSync(dir)) {
  console.error(`error: ${dir} does not exist`);
  process.exit(2);
}

const PHASES = ["01-brainstorm.md", "02-analysis.md", "03-design.md", "04-progress.md", "05-verification.md"];
console.log("Phase files");
for (const f of PHASES) {
  const p = join(dir, f);
  if (!existsSync(p)) {
    console.log(`  ${f.padEnd(20)} not written`);
    continue;
  }
  const status = readFileSync(p, "utf8").split("\n").find((l) => /^Status:/.test(l));
  console.log(`  ${f.padEnd(20)} ${status ?? "(no Status line)"}`);
}

const designPath = join(dir, "03-design.md");
const design = existsSync(designPath) ? parseDesign(readFileSync(designPath, "utf8")) : { slices: [] };
const progressPath = join(dir, "04-progress.md");
const sections = new Map(); // id -> { title, state, items: [{ done, text }] }
const errors = [];
if (existsSync(progressPath)) {
  let current = null;
  for (const line of readFileSync(progressPath, "utf8").split("\n")) {
    const h = line.match(/^##\s+(.*?)\s*$/);
    if (h) {
      const m = h[1].match(/^(.*?)\s*·\s*([^·]+)$/);
      const title = m ? m[1] : h[1];
      const state = m ? m[2].trim().toLowerCase() : "";
      const id = /^Fixes from verification\b/i.test(title) ? "fixes" : (title.match(/^(S\d+)\b/) ?? [])[1];
      if (!id) {
        errors.push(`"## ${h[1]}" is neither a slice ("## S1: … · done") nor "## Fixes from verification · in progress"`);
        current = null;
        continue;
      }
      if (sections.has(id)) errors.push(`${id} has two sections`);
      if (!["done", "in progress"].includes(state)) errors.push(`${id}: state "${state || "(none)"}" is not "done" or "in progress"`);
      current = { title, state, items: [] };
      sections.set(id, current);
      continue;
    }
    const item = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
    if (item && current) current.items.push({ done: item[1] !== " ", text: item[2].trim() });
  }
}

const order = design.slices.map((s) => s.id);
for (const id of sections.keys()) if (id !== "fixes" && order.length && !order.includes(id)) errors.push(`${id} is in the progress file but not in the design`);
console.log("\nSlices");
const rows = [...order, ...[...sections.keys()].filter((id) => !order.includes(id))];
for (const id of rows) {
  const s = sections.get(id);
  if (!s) {
    console.log(`  ${id.padEnd(6)} not started`);
    continue;
  }
  const open = s.items.filter((i) => !i.done);
  console.log(`  ${id.padEnd(6)} ${s.state.padEnd(12)} ${s.items.length - open.length}/${s.items.length}${open.length ? `  open: ${open.map((i) => i.text).join("; ")}` : ""}`);
  if (s.state === "done" && open.length) errors.push(`${id} is marked done with ${open.length} unticked item(s)`);
}

const fixes = sections.get("fixes");
const next =
  fixes && (fixes.state !== "done" || fixes.items.some((i) => !i.done))
    ? "fixes"
    : order.find((id) => sections.get(id)?.state !== "done") ?? null;
console.log(`\nNext: ${next === "fixes" ? "Fixes from verification" : next ?? "every slice is done; run /verify-build"}`);

if (only) {
  const s = sections.get(only);
  if (!s) errors.push(`${only} has no section in ${progressPath}`);
  else if (s.items.length === 0) errors.push(`${only} has no checklist items`);
  else {
    const open = s.items.filter((i) => !i.done);
    if (open.length) errors.push(`${only} has ${open.length} unticked item(s): ${open.map((i) => i.text).join("; ")}`);
  }
}
for (const e of errors) console.log(`error: ${e}`);
process.exit(errors.length ? 1 : 0);
