#!/usr/bin/env node
// Resolves a project, or a combination of technologies, into its stack and the docs that apply, and prints the
// assembly command.
//
//   node resolve-stack.mjs <project dir> [--with <group>]... [--kind "<what it is>"]
//   node resolve-stack.mjs --technologies <name>... [--concepts <concept>...] [--with <group>]... [--kind "<what it is>"]
//
// From a project it detects the technologies from the manifests and config files (three levels deep). It then matches
// them to a blueprint: every technology must belong to the stack, and a required technology that is missing is only
// tolerated when it is toolchain or tooling (reported under Found). The groups picked are the ones whose technologies
// are present, plus each --with, plus the groups those require. Without a blueprint the combination is composed: the
// concepts the technologies realise (plus each --concepts) and every integration whose both ends are present, in
// composition order; it has no Starter. A name that is no technology is a gap.
//
// It prints a block the skill's hand-off is built from: Stack, Blueprint, Technologies (with evidence from a
// project), Concepts, Docs, Starter (the blueprint's Starter parts for the groups picked), Gaps, Found, and the Assemble command to run next (`<out>` is where the
// conventions go). It writes nothing. A combination no doc covers at all exits non-zero.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closure, detectTechnologies, expandGroups, loadGraph, matchStack, orderDocs, parseFrontmatter, pathOf, scanProject, section, starterParts } from './lib/graph.mjs';

const usage = [
  'usage: resolve-stack.mjs <project dir> [--with <group>]... [--kind "<what it is>"]',
  '       resolve-stack.mjs --technologies <name>... [--concepts <concept>...] [--with <group>]... [--kind "<what it is>"]'
].join('\n');

const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const graph = loadGraph(join(skillDir, 'references'));

const args = process.argv.slice(2);
let project;
const named = [];
const concepts = [];
const withGroups = [];
let kind;
let mode = 'positional';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--technologies') {
    mode = 'technologies';
  } else if (a === '--concepts') {
    mode = 'concepts';
  } else if (a === '--with' && args[i + 1]) {
    withGroups.push(args[++i]);
    mode = 'positional';
  } else if (a === '--kind' && args[i + 1]) {
    kind = args[++i];
    mode = 'positional';
  } else if (a.startsWith('--')) {
    console.error(usage);
    process.exit(2);
  } else if (mode === 'technologies') {
    named.push(a);
  } else if (mode === 'concepts') {
    concepts.push(a);
  } else if (!project) {
    project = resolve(a);
  } else {
    console.error(usage);
    process.exit(2);
  }
}
if ((project && named.length > 0) || (!project && named.length === 0)) {
  console.error(usage);
  process.exit(2);
}

const found = [];
const gaps = [];
let technologies;
const evidence = new Map();
if (project) {
  const detected = detectTechnologies(graph, scanProject(project));
  technologies = [...detected.keys()];
  for (const [id, proof] of detected) {
    evidence.set(id, proof);
  }
} else {
  technologies = [];
  for (const name of named) {
    const id = name.toLowerCase();
    if (graph.technologies[id]) {
      technologies.push(id);
    } else {
      gaps.push(`no doc for ${name}`);
    }
  }
}
for (const c of concepts) {
  if (!graph.concepts[c]) {
    gaps.push(`no concept doc for ${c}`);
  }
}
if (technologies.length === 0) {
  console.error(project ? `no known technology found under ${project}` : 'no known technology named');
  console.error(`Gaps: ${gaps.join('; ') || 'none'}`);
  process.exit(1);
}

const match = matchStack(graph, technologies);
const lines = [];
const absolute = (entries) => entries.map((e) => pathOf(graph, e));
const describe = (id) => (evidence.has(id) ? `${id} (${evidence.get(id)[0]})` : id);

if (match) {
  const { stack } = match;
  for (const g of withGroups) {
    if (!stack.optional[g]) {
      found.push(`--with ${g} is not a group of ${stack.title}`);
    }
  }
  const expanded = expandGroups(stack, [...match.groups, ...withGroups.filter((g) => stack.optional[g])]);
  for (const { group, because } of expanded.added) {
    found.push(`group ${group} added because ${because} requires it`);
  }
  if (match.missing.length > 0) {
    found.push(`the stack expects ${match.missing.join(', ')}, not found in the project`);
  }
  const groups = expanded.groups;
  const docs = stack.composition.filter((e) => !e.optional || groups.includes(e.group));
  const ports = /^\| ports +\| (.+?) *\|$/m.exec(section(parseFrontmatter(readFileSync(stack.path, 'utf8')).body, 'Required values') ?? '');
  const outName = '<out>';
  lines.push(
    `Stack: ${stack.title} · with: ${groups.join(', ') || 'none'}`,
    `Blueprint: ${stack.path}`,
    `Technologies: ${closure(graph, technologies).technologies.map(describe).join(', ')}`,
    `Concepts: ${docs.filter((e) => e.kind === 'concept').map((e) => e.id).join(', ')}`,
    `Docs: ${absolute(docs).join(', ')}`,
    `Starter: ${starterLine(starterParts(stack, groups))}`,
    `Ports: ${ports ? ports[1] : 'none'}`,
    `Gaps: ${gaps.join('; ') || 'none'}`,
    `Found: ${found.join('; ') || 'none'}`,
    `Assemble: node ${join(skillDir, 'scripts', 'assemble-conventions.mjs')} ${stack.path}${groups.map((g) => ` --with ${g}`).join('')} --out ${outName}/coding-conventions.md`
  );
} else {
  if (withGroups.length > 0) {
    found.push(`--with applies to a blueprint; this combination has none, so name the technologies instead`);
  }
  const cl = closure(graph, technologies, { extraConcepts: concepts.filter((c) => graph.concepts[c]) });
  const docs = orderDocs(graph, cl);
  const title = (id) => graph.technologies[id].title;
  const shaping = cl.technologies.filter((t) => !['toolchain', 'tooling'].includes(graph.technologies[t].role));
  const what = kind ?? (shaping.length > 0 ? shaping : cl.technologies).map(title).join(' + ');
  const nearest = nearestBlueprint(cl.technologies);
  if (nearest) {
    found.push(`no blueprint; nearest is ${nearest.stack.title} (${nearest.extra.length > 0 ? `without ${nearest.extra.join(', ')}` : ''}${nearest.extra.length > 0 && nearest.lacking.length > 0 ? '; ' : ''}${nearest.lacking.length > 0 ? `lacking ${nearest.lacking.join(', ')}` : ''})`);
  }
  lines.push(
    `Stack: Composed: ${what}`,
    'Blueprint: none',
    `Technologies: ${cl.technologies.map(describe).join(', ')}`,
    `Concepts: ${cl.concepts.join(', ')}`,
    `Docs: ${absolute(docs).join(', ')}`,
    'Starter: none (no blueprint)',
    "Ports: the docs' own; check each",
    `Gaps: ${gaps.join('; ') || 'none'}`,
    `Found: ${found.join('; ') || 'none'}`,
    `Assemble: node ${join(skillDir, 'scripts', 'assemble-conventions.mjs')} --compose "${what}" --out <out>/coding-conventions.md ${absolute(docs).join(' ')}`
  );
}
process.stdout.write(`${lines.join('\n')}\n`);

/** The Starter line: the blueprint's "## Starter", and its parts when it has several. */
function starterLine(parts) {
  return `the blueprint's Starter${parts.length > 0 ? `: ${parts.join('; ')}` : ''}`;
}

/** The blueprint sharing the most technologies with a composed combination. */
function nearestBlueprint(technologies) {
  let best;
  for (const stack of Object.values(graph.stacks)) {
    const all = new Set([...stack.technologies, ...Object.values(stack.optional).flat()]);
    const shared = technologies.filter((t) => all.has(t)).length;
    const extra = technologies.filter((t) => !all.has(t));
    const lacking = stack.technologies.filter((t) => !technologies.includes(t) && !['toolchain', 'tooling'].includes(graph.technologies[t].role));
    if (!best || shared - extra.length - lacking.length > best.score) {
      best = { stack, extra, lacking, score: shared - extra.length - lacking.length };
    }
  }
  return best;
}

