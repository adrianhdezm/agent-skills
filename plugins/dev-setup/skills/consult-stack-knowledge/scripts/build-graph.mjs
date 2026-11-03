#!/usr/bin/env node
// Builds references/graph.json from the docs' frontmatter and checks that the prose agrees with it. check.mjs runs it
// with the other checks.
//
//   node build-graph.mjs [--check] [<references dir>]
//
// Without --check it writes graph.json and the index.md files (the bundle root's, carrying `okf_version`, and one per
// layer listing its docs with their descriptions) and then runs the checks; with --check it only checks, and also fails
// when a committed one is out of date. The checks: every frontmatter parses, and every markdown file but the reserved
// index.md and log.md has a `type` (OKF conformance); every doc's type is its layer's, its title its H1, and it has a
// description; OKF's optional fields are well formed (datetimes with an offset, actors, statuses, sources with a
// resource, and each `[^id]` footnote naming a source, defined and cited); every doc has a row in catalog.md whose
// summary is its description, and every catalog row a doc; every edge names a doc that exists; a doc's Realises line
// lists exactly the concepts its frontmatter does; each blueprint's Composition is exactly what its technologies and
// optional groups bring (an entry marked `— optional (<group>)` is brought by that group and not by the stack alone,
// while an entry listed unconditionally though only a group brings it is allowed, since the assembly keeps it: the
// React Router stacks list Database and Data access ahead of the `database` group); each blueprint has a Starter whose
// parts name only its own groups; and the Stacks table of SKILL.md names each blueprint and its groups. It prints each
// violation with the fix, and exits non-zero when there is one.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandGroups, footnotes, LAYERS, linkedIds, loadGraph, parseFrontmatter, RESERVED, stackClosure, STATUSES, tableRows } from './lib/graph.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const root = resolve(args.find((a) => !a.startsWith('--')) ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'references'));
const graph = loadGraph(root);
const problems = [...graph.problems];
const docs = [...Object.values(graph.concepts), ...Object.values(graph.technologies).filter((t) => !t.external), ...Object.values(graph.integrations), ...Object.values(graph.stacks)];

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

const catalogText = readFileSync(join(root, 'catalog.md'), 'utf8');
const catalog = linkedIds(catalogText);
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
// A catalog row's second cell is its doc's description, word for word.
for (const row of tableRows(catalogText)) {
  const link = linkedIds(row[0])[0];
  const doc = link && { architecture: graph.concepts, technologies: graph.technologies, integrations: graph.integrations }[link.layer]?.[link.id];
  if (doc && typeof doc.description === 'string' && row[1] !== doc.description) {
    problems.push(`catalog.md: the row for ${doc.file} says "${row[1]}" but its description is "${doc.description}": make them the same`);
  }
}

// --- OKF: every file conforms, and the optional fields are well formed ---------------------------------------------

const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const ACTOR = /^(human|process):\S+$|^[^\s/:]+\/\S+$/;
const PATH = /^(https?:\/\/\S+|\/\S*|\.{0,2}\/?[\w.-]\S*)$/;

/** Every markdown file under the bundle root but the reserved ones carries a non-empty `type` (OKF §11). */
function* markdownFiles(dir, rel = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      yield* markdownFiles(join(dir, entry.name), `${rel}${entry.name}/`);
    } else if (entry.name.endsWith('.md')) {
      yield { path: join(dir, entry.name), file: `${rel}${entry.name}`, name: entry.name };
    }
  }
}
const docFiles = new Set(docs.map((d) => d.file));
for (const { path, file, name } of markdownFiles(root)) {
  if (RESERVED.has(name) || docFiles.has(file)) {
    continue; // a doc's type is checked against its layer by loadGraph
  }
  let data;
  try {
    data = parseFrontmatter(readFileSync(path, 'utf8'), file).data;
  } catch {
    problems.push(`${file}: its frontmatter does not parse`);
    continue;
  }
  if (typeof data.type !== 'string' || data.type === '') {
    problems.push(`${file}: no type in its frontmatter: every markdown file but index.md and log.md needs one (OKF)`);
  }
}

function checkDatetime(file, what, value) {
  if (typeof value !== 'string' || !DATETIME.test(value)) {
    problems.push(`${file}: ${what} is "${value}", not an ISO 8601 datetime with an offset (2027-05-01T00:00:00Z)`);
  }
}
function checkStamp(file, what, stamp) {
  if (typeof stamp !== 'object' || Array.isArray(stamp) || typeof stamp.by !== 'string' || !ACTOR.test(stamp.by)) {
    problems.push(`${file}: ${what} needs by: human:<id>, process:<id> or <producer>/<version>`);
    return;
  }
  if (stamp.at !== undefined) {
    checkDatetime(file, `${what}.at`, stamp.at);
  }
}
for (const doc of docs) {
  const { file } = doc;
  const { body } = parseFrontmatter(readFileSync(doc.path, 'utf8'));
  if (typeof doc.description !== 'string' || doc.description === '') {
    problems.push(`${file}: no description: add its one-line summary${doc.kind === 'stack' ? '' : ', the same as its catalog row'}`);
  }
  if (doc.resource !== undefined && (typeof doc.resource !== 'string' || !PATH.test(doc.resource))) {
    problems.push(`${file}: resource "${doc.resource}" is not a URL or a path`);
  }
  if (doc.status !== undefined && !STATUSES.includes(doc.status)) {
    problems.push(`${file}: status "${doc.status}" is not one of ${STATUSES.join(', ')}`);
  }
  if (doc.stale_after !== undefined) {
    checkDatetime(file, 'stale_after', doc.stale_after);
  }
  if (doc.generated !== undefined) {
    checkStamp(file, 'generated', doc.generated);
  }
  for (const [n, stamp] of (doc.verified ?? []).entries()) {
    checkStamp(file, `verified[${n}]`, stamp);
    if (stamp?.at === undefined) {
      problems.push(`${file}: verified[${n}] needs at: the datetime it was confirmed`);
    }
  }
  const sources = doc.sources ?? [];
  if (!Array.isArray(sources)) {
    problems.push(`${file}: sources is a list of { id, resource, title }`);
    continue;
  }
  const ids = new Set();
  for (const [n, source] of sources.entries()) {
    if (typeof source !== 'object' || typeof source.resource !== 'string' || source.resource === '') {
      problems.push(`${file}: sources[${n}] needs a resource`);
      continue;
    }
    if (source.id !== undefined) {
      if (ids.has(source.id)) {
        problems.push(`${file}: two sources have the id "${source.id}"`);
      }
      ids.add(source.id);
    }
    if (source.last_modified !== undefined) {
      checkDatetime(file, `sources[${n}].last_modified`, source.last_modified);
    }
  }
  const { markers, definitions } = footnotes(body);
  for (const label of new Set([...markers, ...definitions])) {
    if (!ids.has(label)) {
      problems.push(`${file}: the footnote [^${label}] names no source: add { id: ${label}, resource, title } to its sources`);
    } else if (!markers.includes(label)) {
      problems.push(`${file}: the footnote [^${label}] is defined but never cited`);
    } else if (!definitions.includes(label)) {
      problems.push(`${file}: the footnote [^${label}] is cited but has no "[^${label}]: <title>" line at the end`);
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
// --- the index.md files: OKF's progressive disclosure, generated like graph.json ---------------------------------

const LAYER_INDEX = {
  architecture: ['Architecture', 'the concepts: what holds whatever the technology'],
  technologies: ['Technologies', 'one technology each: how it is used, its required values and pitfalls'],
  integrations: ['Integrations', 'where code from one technology calls into another'],
  stacks: ['Blueprints', 'the house stacks, each composed from the docs above']
};
const entry = (doc, href) => `* [${doc.title}](${href}) - ${doc.description}${doc.status === 'deprecated' ? ' (deprecated)' : ''}`;
const generated = new Map([['graph.json', serialised]]);
const catalogData = parseFrontmatter(catalogText, 'catalog.md').data;
const rootIndex = ['---', 'okf_version: "0.2"', '---', '# Stack knowledge', '', `* [${catalogData.title}](catalog.md) - ${catalogData.description}`, '', '# Layers', ''];
for (const [dir, kind] of Object.entries(LAYERS)) {
  const [heading, about] = LAYER_INDEX[dir];
  const table = { concept: graph.concepts, technology: graph.technologies, integration: graph.integrations, stack: graph.stacks }[kind];
  const ids = graph.order[kind].filter((id) => !table[id].external);
  rootIndex.push(`* [${heading}](${dir}/) - ${about} (${ids.length} docs)`);
  generated.set(`${dir}/index.md`, `# ${heading}\n\n${ids.map((id) => entry(table[id], `${id}.md`)).join('\n')}\n`);
}
generated.set('index.md', `${rootIndex.join('\n')}\n`);

for (const [file, content] of generated) {
  const target = join(root, file);
  if (checkOnly) {
    let current;
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = '';
    }
    if (current !== content) {
      problems.push(`${file} is out of date: run build-graph.mjs`);
    }
  } else {
    writeFileSync(target, content);
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} problems`);
  process.exit(1);
}
const counts = `${Object.keys(graph.concepts).length} concepts, ${graph.order.technology.length} technologies, ${Object.keys(graph.integrations).length} integrations, ${Object.keys(graph.stacks).length} stacks`;
console.log(`${checkOnly ? 'graph.json and the index.md files are current' : 'graph.json and the index.md files written'}: ${counts}`);
