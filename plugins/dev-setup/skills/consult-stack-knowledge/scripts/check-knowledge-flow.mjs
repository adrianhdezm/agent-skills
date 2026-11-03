#!/usr/bin/env node
// Checks that knowledge flows one way: architecture ← technologies ← integrations ← examples ← stacks.
//
//   node check-knowledge-flow.mjs [<references dir>]
//
// The references dir defaults to this skill's.
//
// A technology doc names no other technology that has a doc, and links to no other technology or integration doc; an
// architecture doc names no technology and links to no technology, integration or example doc. Both may link up to an
// architecture doc. How each technology is recognised in text is its doc's `aliases` (a word, or a literal such as
// `@angular/`); a doc whose `family` names another technology may use that technology's vocabulary (the Cloudflare
// products are bound to a Worker and created by Wrangler, NgRx exists only inside Angular). The shared toolchain
// (`pnpm …`, `node …`, `tsconfig*.json`) and the test runner (`vitest`) are allowed inside code spans, as notation.
// Frontmatter is not prose and is not checked. It prints each violation as file:line and exits non-zero when there is
// one.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraph } from './lib/graph.mjs';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'references'));
const graph = loadGraph(root);

/** An alias as a pattern: word boundaries around the ends that are word characters, the rest literal. */
function pattern(alias) {
  const literal = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${/^\w/.test(alias) ? '\\b' : ''}${literal}${/\w$/.test(alias) ? '\\b' : ''}`);
}

/** How each technology with a doc is recognised in text, keyed by its doc's base name. */
const names = Object.fromEntries(
  Object.values(graph.technologies)
    .filter((t) => !t.external)
    .map((t) => [t.id, (t.aliases ?? []).map(pattern)])
);
/** Allowed as notation inside a code span. */
const notation = new Set(['pnpm', 'node', 'typescript', 'vitest']);

/** Whether `doc` may name `tech`: itself, or the family it belongs to. */
function allowed(layer, doc, tech) {
  return layer === 'technologies' && (tech === doc || graph.technologies[doc]?.family === tech);
}

/** Lines outside code fences and frontmatter, with their numbers, and each line's prose (code spans removed) beside it. */
function lines(text) {
  const out = [];
  let fenced = false;
  let frontmatter = text.startsWith('---\n');
  text.split('\n').forEach((line, i) => {
    if (frontmatter) {
      if (i > 0 && line === '---') {
        frontmatter = false;
      }
      return;
    }
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      return;
    }
    if (!fenced) {
      out.push({ n: i + 1, line, prose: line.replace(/`[^`]*`/g, '') });
    }
  });
  return out;
}

const problems = [];

function check(layer, allowedLinks) {
  for (const file of readdirSync(join(root, layer)).filter((f) => f.endsWith('.md'))) {
    const doc = basename(file, '.md');
    const path = join(root, layer, file);
    for (const { n, line, prose } of lines(readFileSync(path, 'utf8'))) {
      for (const [, target] of line.matchAll(/\]\(\.\.\/([a-z]+)\/[^)]+\)/g)) {
        if (!allowedLinks.includes(target)) {
          problems.push(`${layer}/${file}:${n}: links to ${target}/`);
        }
      }
      for (const [tech, patterns] of Object.entries(names)) {
        if (allowed(layer, doc, tech)) {
          continue;
        }
        const text = notation.has(tech) ? prose : line;
        const hit = patterns.find((p) => p.test(text));
        if (hit) {
          problems.push(`${layer}/${file}:${n}: names ${tech} (${hit.source})`);
        }
      }
    }
  }
}

check('technologies', ['architecture']);
check('architecture', []);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} violations`);
  process.exit(1);
}
console.log('knowledge flows one way');
