#!/usr/bin/env node
// Builds references/graph.json from the docs' frontmatter and checks that the prose agrees with it. check.mjs runs it
// with the other checks.
//
//   node build-graph.mjs [--check] [<references dir>]
//
// Without --check it writes graph.json and then runs the checks; with --check it only checks, and also fails when the
// committed graph.json is out of date. The checks: every frontmatter parses; every doc has a row in catalog.md and
// every catalog row a doc; every edge names a doc that exists; a doc's Realises line lists exactly the concepts its
// frontmatter does; each blueprint's Composition is exactly what its technologies and optional groups bring (an entry
// marked `— optional (<group>)` is brought by that group and not by the stack alone, while an entry listed
// unconditionally though only a group brings it is allowed, since the assembly keeps it: the React Router stacks list
// Database and Data access ahead of the `database` group); each blueprint has a Starter whose parts name only its own
// groups; and the Stacks table of SKILL.md names each blueprint and its groups. It prints each violation with the fix,
// and exits non-zero when there is one.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closure, expandGroups, linkedIds, loadGraph, parseFrontmatter, stackClosure, stackTechnologies, tableRows } from './lib/graph.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const root = resolve(args.find((a) => !a.startsWith('--')) ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'references'));
const graph = loadGraph(root);
const problems = [...graph.problems];

// --- every edge resolves -------------------------------------------------------------------------------------------

const has = (kind, id) => ({ concept: graph.concepts, technology: graph.technologies, integration: graph.integrations, stack: graph.stacks })[kind][id] !== undefined;
const check = (file, kind, ids, what) => {
  for (const id of ids) {
    if (!has(kind, id)) {
      problems.push(`${file}: ${what} names no ${kind} "${id}"`);
    }
  }
};
for (const t of Object.values(graph.technologies).filter((t) => !t.external)) {
  check(t.file, 'concept', t.realises, 'realises');
  if (t.family) {
    check(t.file, 'technology', [t.family], 'family');
  }
}
for (const i of Object.values(graph.integrations)) {
  check(i.file, 'concept', i.realises, 'realises');
  check(i.file, 'technology', i.unless, 'unless');
  if (i.connects.length === 0) {
    problems.push(`${i.file}: connects nothing`);
  }
  if (i.connects.some((t) => graph.technologies[t].external) && !i.detect) {
    problems.push(`${i.file}: connects an external technology, so it needs its own detect`);
  }
}
for (const s of Object.values(graph.stacks)) {
  check(s.file, 'technology', s.technologies, 'technologies');
  check(s.file, 'technology', Object.values(s.optional).flat(), 'optional');
  check(s.file, 'concept', s.concepts, 'concepts');
  for (const [g, needs] of Object.entries(s.requires)) {
    for (const n of [g, ...needs]) {
      if (!s.optional[n]) {
        problems.push(`${s.file}: requires names no optional group "${n}"`);
      }
    }
  }
}

// --- the Realises line says what the frontmatter says ------------------------------------------------------------

for (const doc of [...Object.values(graph.technologies).filter((t) => !t.external), ...Object.values(graph.integrations)]) {
  const { body } = parseFrontmatter(readFileSync(doc.path, 'utf8'));
  const line = /^\*\*Realises:\*\* (.+)$/m.exec(body);
  const stated = line ? linkedIds(line[1]).filter((l) => l.layer === 'architecture').map((l) => l.id) : [];
  if (stated.join() !== doc.realises.join()) {
    problems.push(`${doc.file}: Realises line says [${stated}] but frontmatter says [${doc.realises}]`);
  }
}

// --- the catalog lists every doc, and only docs ---------------------------------------------------------------------

const catalog = linkedIds(readFileSync(join(root, 'catalog.md'), 'utf8'));
for (const kind of ['concept', 'technology', 'integration']) {
  const layer = { concept: 'architecture', technology: 'technologies', integration: 'integrations' }[kind];
  const listed = catalog.filter((l) => l.layer === layer).map((l) => l.id);
  for (const id of graph.order[kind]) {
    if (!graph[`${kind === 'technology' ? 'technologies' : `${kind}s`}`][id].external && !listed.includes(id)) {
      problems.push(`catalog.md: no row for ${layer}/${id}.md: add one to its layer's table`);
    }
  }
  for (const id of listed) {
    if (!has(kind, id)) {
      problems.push(`catalog.md: links to ${layer}/${id}.md, which does not exist`);
    }
  }
}

// --- each blueprint lists exactly what its technologies bring ----------------------------------------------------

for (const stack of Object.values(graph.stacks)) {
  const groups = Object.keys(stack.optional);
  const key = (e) => `${e.kind}:${e.id}`;
  const full = stackClosure(graph, stack, groups);
  const expected = new Set([
    ...full.concepts.map((id) => `concept:${id}`),
    ...full.technologies.filter((t) => !graph.technologies[t].external).map((id) => `technology:${id}`),
    ...full.integrations.map((id) => `integration:${id}`)
  ]);
  const listed = new Set(stack.composition.map(key));
  for (const k of expected) {
    if (!listed.has(k)) {
      problems.push(`${stack.file}: Composition lacks ${k}, which its technologies bring: add its link, marked optional when only a group brings it`);
    }
  }
  for (const k of listed) {
    if (!expected.has(k)) {
      problems.push(`${stack.file}: Composition lists ${k}, which none of its technologies brings`);
    }
  }
  const base = stackClosure(graph, stack, []);
  const baseKeys = new Set([...base.concepts.map((id) => `concept:${id}`), ...base.technologies.map((id) => `technology:${id}`), ...base.integrations.map((id) => `integration:${id}`)]);
  for (const entry of stack.composition) {
    if (entry.optional) {
      if (!groups.includes(entry.group)) {
        problems.push(`${stack.file}: ${key(entry)} is marked optional (${entry.group}), not a group of this stack`);
        continue;
      }
      const withGroup = stackClosure(graph, stack, expandGroups(stack, [entry.group]).groups);
      const inGroup = [...withGroup.concepts.map((id) => `concept:${id}`), ...withGroup.technologies.map((id) => `technology:${id}`), ...withGroup.integrations.map((id) => `integration:${id}`)];
      if (!inGroup.includes(key(entry))) {
        problems.push(`${stack.file}: ${key(entry)} is marked optional (${entry.group}) but that group does not bring it`);
      } else if (baseKeys.has(key(entry))) {
        problems.push(`${stack.file}: ${key(entry)} is marked optional (${entry.group}) but the stack brings it without the group`);
      }
    }
  }
  // Starter: what a fresh scaffold ships, each part that needs a group naming one of the stack's.
  if (!stack.starter) {
    problems.push(`${stack.file}: no "## Starter" section`);
  }
  for (const part of stack.starter ?? []) {
    if (part.group && !groups.includes(part.group)) {
      problems.push(`${stack.file}: Starter part "${part.title}" names ${part.group}, not a group of this stack`);
    }
  }
}

// --- the Stacks table in SKILL.md ----------------------------------------------------------------------------------

const skill = readFileSync(join(root, '..', 'SKILL.md'), 'utf8');
const stacksSection = skill.slice(skill.indexOf('## Stacks'), skill.indexOf('## Workflow'));
const rows = tableRows(stacksSection).filter((r) => /\]\(references\/stacks\//.test(r[r.length - 1] ?? ''));
const inTable = new Set();
for (const row of rows) {
  const id = /\]\(references\/stacks\/([a-z0-9-]+)\.md\)/.exec(row[row.length - 1])?.[1];
  const stack = graph.stacks[id];
  if (!stack) {
    problems.push(`SKILL.md: Stacks table links to stacks/${id}.md, which does not exist`);
    continue;
  }
  inTable.add(id);
  const groups = [...row[row.length - 2].matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]).sort();
  const declared = Object.keys(stack.optional).sort();
  if (groups.join() !== declared.join()) {
    problems.push(`SKILL.md: Stacks table lists groups [${groups}] for ${id} but its frontmatter declares [${declared}]`);
  }
}
for (const id of Object.keys(graph.stacks)) {
  if (!inTable.has(id)) {
    problems.push(`SKILL.md: Stacks table has no row for stacks/${id}.md`);
  }
}

// --- write or compare graph.json -----------------------------------------------------------------------------------

const serialised = `${JSON.stringify(
  {
    concepts: graph.concepts,
    technologies: graph.technologies,
    integrations: graph.integrations,
    stacks: graph.stacks,
    order: graph.order
  },
  (key, value) => (key === 'path' || key === 'problems' ? undefined : value),
  2
)}\n`;
const target = join(root, 'graph.json');
if (checkOnly) {
  let current;
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    current = '';
  }
  if (current !== serialised) {
    problems.push('graph.json is out of date: run build-graph.mjs');
  }
} else {
  writeFileSync(target, serialised);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} problems`);
  process.exit(1);
}
const counts = `${Object.keys(graph.concepts).length} concepts, ${graph.order.technology.length} technologies, ${Object.keys(graph.integrations).length} integrations, ${Object.keys(graph.stacks).length} stacks`;
console.log(`${checkOnly ? 'graph.json is current' : 'graph.json written'}: ${counts}`);
