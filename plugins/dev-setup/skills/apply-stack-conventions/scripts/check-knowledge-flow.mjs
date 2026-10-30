#!/usr/bin/env node
// Checks that knowledge flows one way: architecture ← technologies ← integrations ← examples ← stacks.
//
//   node check-knowledge-flow.mjs [<references dir>]
//
// A technology doc names no other technology that has a doc, and links to no other technology or integration doc; an
// architecture doc names no technology and links to no technology, integration or example doc. Both may link up to an
// architecture doc. The shared toolchain (`pnpm …`, `node …`, `tsconfig*.json`) is allowed inside code spans, as
// notation. It prints each violation as file:line and exits non-zero when there is one.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'references'));

/** How each technology with a doc is recognised in text, keyed by its doc's base name. */
const names = {
  angular: [/\bAngular\b/, /@angular\//],
  'better-auth': [/\bBetter Auth\b/, /\bbetter-auth\b/, /\bbetterAuth\b/],
  'cloudflare-d1': [/\bD1\b/],
  'cloudflare-r2': [/\bR2\b/],
  'cloudflare-workers': [/\bWorkers?\b/, /\bworkerd\b/, /\bWrangler\b/, /\bwrangler\b/, /\bCloudflare\b/],
  'docker-compose': [/\bDocker\b/, /\bCompose\b/, /\bdocker-compose\b/, /\bdocker compose\b/],
  drizzle: [/\bDrizzle\b/, /\bdrizzle\b/],
  eslint: [/\bESLint\b/, /\beslint\b/],
  express: [/\bExpress\b/, /\bexpress\(\)/, /`express`/],
  hono: [/\bHono\b/, /\bhono\b/],
  ngrx: [/\bNgRx\b/, /@ngrx\//],
  nginx: [/\bNginx\b/, /\bnginx\b/],
  node: [/\bNode\b/],
  pnpm: [/\bpnpm\b/],
  postgres: [/\bPostgres(?:QL)?\b/, /\bpostgres:/, /`pg`/],
  prettier: [/\bPrettier\b/, /\bprettier\b/],
  'react-router': [/\bReact Router\b/, /\breact-router\b/, /\breactRouter\(/],
  's3-storage': [/\bRustFS\b/, /\bS3\b/],
  shadcn: [/\bshadcn\b/],
  storybook: [/\bStorybook\b/, /@storybook\//, /\bstorybook@/],
  tailwind: [/\bTailwind\b/, /\btailwindcss\b/],
  typescript: [/\bTypeScript\b/],
  vitest: [/\bVitest\b/, /\bvitest\b/]
};
/**
 * Docs of one platform share its vocabulary: the Cloudflare products are bound to a Worker and created by Wrangler, and
 * NgRx exists only inside Angular.
 */
const families = [
  ['cloudflare-workers', 'cloudflare-d1', 'cloudflare-r2'],
  ['angular', 'ngrx']
];
const shared = { 'cloudflare-workers': names['cloudflare-workers'], angular: names.angular };
/** Allowed as notation inside a code span. */
const notation = new Set(['pnpm', 'node', 'typescript']);

/** Whether `doc` may use this pattern of `tech`: its own names, or its platform's shared vocabulary. */
function allowed(layer, doc, tech, pattern) {
  if (layer !== 'technologies') {
    return false;
  }
  if (tech === doc) {
    return true;
  }
  const inFamily = families.some((f) => f.includes(doc) && f.includes(tech));
  return inFamily && (shared[tech] ?? []).some((s) => s.source === pattern.source);
}

/** Lines outside code fences, with their numbers, and each line's prose (code spans removed) beside it. */
function lines(text) {
  const out = [];
  let fenced = false;
  text.split('\n').forEach((line, i) => {
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
        const text = notation.has(tech) ? prose : line;
        const hit = patterns.find((p) => p.test(text) && !allowed(layer, doc, tech, p));
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
