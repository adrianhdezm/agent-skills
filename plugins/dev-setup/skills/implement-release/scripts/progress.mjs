#!/usr/bin/env node
// Reports where an initiative stands, from the files in docs/<slug>/.
//
//   node progress.mjs <docs/<slug>> [--slice <S2 | fixes>]
//
// Prints the Status line of each phase file, each release of the spec with its slices, then each slice of the
// tech plan with its state in 04-progress.md, then what to build next: the open "Fixes from verification" section
// first, then the first slice not done; when every planned slice is done, the release to verify and the one to
// plan next.
// Errors: a section marked done with an unticked item, a section whose state is not "done" or "in progress", or a
// section in the progress file that is not a slice of the tech plan. With --slice, also exits 1 when that section has
// an unticked item, so a slice cannot be closed with work left on it. Exit 0: clean · 1: errors · 2: could not run.

import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseSpec, releaseOf } from "../../specify-idea/scripts/spec.mjs";
import { parseTechPlan } from "../../plan-release/scripts/tech-plan.mjs";

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

const PHASES = ["01-brainstorm.md", "01-experiment.md", "02-spec.md", "03-tech-plan.md", "04-progress.md", "05-verification.md"];
console.log("Phase files");
for (const f of PHASES) {
  const p = join(dir, f);
  if (!existsSync(p)) {
    console.log(`  ${f.padEnd(22)} not written`);
    continue;
  }
  const status = readFileSync(p, "utf8").split("\n").find((l) => /^Status:/.test(l));
  console.log(`  ${f.padEnd(22)} ${status ?? "(no Status line)"}`);
}

const planPath = join(dir, "03-tech-plan.md");
const plan = existsSync(planPath) ? parseTechPlan(readFileSync(planPath, "utf8")) : { slices: [] };
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

const order = plan.slices.map((s) => s.id);
for (const id of sections.keys()) if (id !== "fixes" && order.length && !order.includes(id)) errors.push(`${id} is in the progress file but not in the tech plan`);
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

// Releases: which slices ship each one. S0 sets the project up for the first.
const specPath = join(dir, "02-spec.md");
const spec = existsSync(specPath) ? parseSpec(readFileSync(specPath, "utf8")) : { releases: null };
const releaseFor = releaseOf(spec);
const releases = (spec.releases ?? []).map((r, i) => ({
  ...r,
  slices: plan.slices.filter((s) => (s.id === "S0" ? i === 0 : releaseFor.get(s.covers[0]) === r.id)).map((s) => s.id)
}));
if (releases.length) {
  console.log("\nReleases");
  for (const r of releases) {
    const done = r.slices.filter((id) => sections.get(id)?.state === "done").length;
    console.log(`  ${r.id.padEnd(4)} ${r.name.padEnd(28)} ${r.slices.length ? `${r.slices.join(", ")} · ${done}/${r.slices.length} done` : "not planned"}`);
  }
}

const fixes = sections.get("fixes");
const next =
  fixes && (fixes.state !== "done" || fixes.items.some((i) => !i.done))
    ? "fixes"
    : order.find((id) => sections.get(id)?.state !== "done") ?? null;
let allDone = "every slice is done; run /verify-release";
const planned = releases.filter((r) => r.slices.length);
if (planned.length) {
  const later = releases.find((r) => !r.slices.length);
  const slug = basename(resolve(dir));
  allDone = `every slice of ${planned.at(-1).id} is done; run /verify-release ${slug} ${planned.at(-1).id}${later ? `, then /plan-release ${slug} ${later.id}` : ""}`;
}
console.log(`\nNext: ${next === "fixes" ? "Fixes from verification" : next ?? allDone}`);

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
