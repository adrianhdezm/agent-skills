#!/usr/bin/env node
// The rules that govern a file, or a topic, in a project: resolves the project's stack, keeps the docs that apply, and
// prints the sections of the ones that claim the file or mention the topic.
//
//   node dossier.mjs <project dir> <file>... [--sections <name>,...] [--with <group>]...
//   node dossier.mjs <project dir> --topic <word>... [--sections <name>,...] [--with <group>]...
//
// A file is claimed by a doc when its "Where it lives" or "Layout" table, or a file its Required values names, matches
// the path (`<resource>` and `*` match one path segment, a trailing `/` a directory, a bare file name any file of that
// name). A doc that owns a file names it in one of those, and drops it when it stops owning it. A doc mentions a topic
// when a bullet or table row of its sections holds every word. The sections printed default to Conventions and
// Pitfalls; `--sections all` prints the whole doc. Paths are relative to the project. Nothing claiming a file, or
// nothing mentioning a topic, is said so and exits non-zero. A doc that is deprecated, a draft or past its
// `stale_after` says so under its heading, and a `[^id]` footnote is printed as a link to the source it cites.
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { citeSources, closure, detectTechnologies, expandGroups, headings, lifecycleNotes, loadGraph, matchStack, orderDocs, parseFrontmatter, pathOf, proseLines, scanProject, section, stackClosure } from './lib/graph.mjs';

const usage = [
  'usage: dossier.mjs <project dir> <file>... [--sections <name>,...] [--with <group>]...',
  '       dossier.mjs <project dir> --topic <word>... [--sections <name>,...] [--with <group>]...'
].join('\n');

const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const graph = loadGraph(join(skillDir, 'references'));

const args = process.argv.slice(2);
let project;
const files = [];
const topic = [];
const withGroups = [];
let sections = ['Conventions', 'Pitfalls'];
let mode = 'files';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--topic') {
    mode = 'topic';
  } else if (a === '--sections' && args[i + 1]) {
    sections = args[++i].split(',').map((s) => s.trim());
  } else if (a === '--with' && args[i + 1]) {
    withGroups.push(args[++i]);
  } else if (a.startsWith('--')) {
    console.error(usage);
    process.exit(2);
  } else if (!project) {
    project = resolve(a);
  } else if (mode === 'topic') {
    topic.push(a.toLowerCase());
  } else {
    files.push(relative(project, resolve(project, a)).replace(/\\/g, '/'));
  }
}
if (!project || (files.length === 0 && topic.length === 0)) {
  console.error(usage);
  process.exit(2);
}

// --- the docs that apply ---------------------------------------------------------------------------------------------

const detected = detectTechnologies(graph, scanProject(project));
const technologies = [...detected.keys()];
const match = technologies.length > 0 ? matchStack(graph, technologies) : undefined;
let docs;
let stackLine;
if (match) {
  const { stack } = match;
  const groups = expandGroups(stack, [...match.groups, ...withGroups.filter((g) => stack.optional[g])]).groups;
  docs = [{ kind: 'stack', id: stack.id }, ...stack.composition.filter((e) => !e.optional || groups.includes(e.group))];
  stackLine = `${stack.title} · with: ${groups.join(', ') || 'none'}`;
} else if (technologies.length > 0) {
  docs = orderDocs(graph, closure(graph, technologies));
  stackLine = `Composed: ${technologies.join(', ')}`;
} else {
  docs = [];
  stackLine = 'none detected';
}
const nodeOf = (e) => ({ concept: graph.concepts, technology: graph.technologies, integration: graph.integrations, stack: graph.stacks })[e.kind][e.id];

// --- matching ----------------------------------------------------------------------------------------------------

function claimRegex(pattern) {
  const escaped = pattern
    .replace(/<[^>]+>/g, '*')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*');
  if (pattern.endsWith('/')) {
    return new RegExp(`(^|/)${escaped}`);
  }
  return new RegExp(`(^|/)${escaped}$`);
}

function claimsFor(file) {
  const hits = [];
  for (const entry of docs) {
    const node = nodeOf(entry);
    for (const claim of node.owns ?? []) {
      for (const pattern of claim.path.split(',').map((p) => p.trim()).filter(Boolean)) {
        if (claimRegex(pattern).test(file)) {
          hits.push({ entry, node, claim: { ...claim, path: pattern } });
        }
      }
    }
  }
  return hits;
}

/** A doc's body, each `[^id]` footnote turned into a link to the source it cites. */
function bodyOf(node) {
  return citeSources(parseFrontmatter(readFileSync(node.path, 'utf8')).body, node.sources);
}

/** A doc's heading in the output, with what to know before relying on it. */
function printHeading(node, suffix = '') {
  process.stdout.write(`\n## ${node.title}${suffix}\n\n`);
  for (const note of lifecycleNotes(node)) {
    process.stdout.write(`> ${note}\n\n`);
  }
}

function printSections(node) {
  const body = bodyOf(node);
  if (sections.includes('all')) {
    process.stdout.write(`${body.trim()}\n\n`);
    return;
  }
  const present = headings(body).filter((h) => h.level === 2).map((h) => h.title);
  for (const name of sections) {
    if (!present.includes(name)) {
      continue;
    }
    process.stdout.write(`### ${name}\n\n${section(body, name).replace(/^### /gm, '#### ')}\n\n`);
  }
}

/** The bullets and table rows of a doc's sections, each with its section's name. */
function items(node) {
  const body = bodyOf(node);
  const out = [];
  let current = '';
  let item;
  const flush = () => {
    if (item) {
      out.push({ section: current, text: item });
      item = undefined;
    }
  };
  for (const line of proseLines(body)) {
    const heading = /^(#{2,3}) (.+)$/.exec(line);
    if (heading) {
      flush();
      current = heading[1].length === 2 ? heading[2] : `${current.split(' › ')[0]} › ${heading[2]}`;
    } else if (/^- /.test(line) || (/^\| /.test(line) && !/^\|[\s|:-]+\|$/.test(line))) {
      flush();
      item = line.trim();
    } else if (item && /^ {2,}\S/.test(line)) {
      item += ` ${line.trim()}`;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

// --- output ----------------------------------------------------------------------------------------------------

let failed = false;
process.stdout.write(`Stack: ${stackLine}\n`);
for (const file of files) {
  const hits = claimsFor(file);
  process.stdout.write(`\nFile: ${file}\n`);
  if (hits.length === 0) {
    process.stdout.write('Claimed by: no doc that applies to this project names this file\n');
    failed = true;
    continue;
  }
  process.stdout.write('Claimed by:\n');
  for (const { node, claim } of hits) {
    process.stdout.write(`- ${node.title} (${node.path}), ${claim.source}: \`${claim.path}\` holds ${claim.holds}\n`);
  }
  const seen = new Set();
  for (const { node } of hits) {
    if (seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);
    printHeading(node);
    printSections(node);
  }
}
if (topic.length > 0) {
  process.stdout.write(`\nTopic: ${topic.join(' ')}\n`);
  let any = false;
  for (const entry of docs) {
    const node = nodeOf(entry);
    const matching = items(node).filter((it) => {
      const text = it.text.toLowerCase();
      return topic.every((word) => text.includes(word));
    });
    if (matching.length === 0) {
      continue;
    }
    any = true;
    printHeading(node, ` (${node.path})`);
    for (const it of matching) {
      process.stdout.write(`- [${it.section}] ${it.text.replace(/^- /, '')}\n`);
    }
  }
  if (!any) {
    process.stdout.write('No doc that applies to this project mentions it.\n');
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
