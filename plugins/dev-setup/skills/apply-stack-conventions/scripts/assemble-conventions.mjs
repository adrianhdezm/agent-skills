#!/usr/bin/env node
// Assembles a project's coding-conventions.md from a stack blueprint and the docs its composition lists, or, for a
// combination no blueprint covers, from a title and the docs the project was built from.
//
//   node assemble-conventions.mjs <stack file> [--with <optional entry>]... > coding-conventions.md
//   node assemble-conventions.mjs <stack file> [--with <optional entry>]... --list
//   node assemble-conventions.mjs --compose "<project kind>" <doc>... > coding-conventions.md
//
// The blueprint's "## Composition" section lists the architecture, technology and integration docs as a bulleted list
// of links, in the order their conventions appear. An entry ending in " — optional" is included only when its file's
// base name is passed with --with (`--with angular-fundamental-ngx`); one ending in " — optional (<group>)" when its
// group is, so `--with authentication` brings in every entry of that group. Its "## Examples" section lists the
// examples a fresh scaffold starts with.
// The output holds the stack's own "## Conventions" section first (none in --compose mode), then each doc's
// "## Conventions" section under the doc's title. With --list it prints instead the hand-off's Docs and Examples lines:
// the absolute paths of the docs that apply, in composition order, and of the examples.
// It exits non-zero when a section is missing, when --with names no optional entry, or when the result would carry a
// relative link to a file (it lives in the project, not beside the skill) or an anchor that does not resolve.
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const usage = [
  'usage: assemble-conventions.mjs <stack file> [--with <optional entry>]... [--list]',
  '       assemble-conventions.mjs --compose "<project kind>" <doc>...'
].join('\n');
const composing = args[0] === '--compose';
const opted = new Set();
let listing = false;
let usable = composing ? args.length >= 3 : args.length >= 1 && !args[0].startsWith('--');
for (let i = 1; !composing && usable && i < args.length; i++) {
  if (args[i] === '--list') {
    listing = true;
  } else if (args[i] === '--with' && i + 1 < args.length) {
    opted.add(args[++i]);
  } else {
    usable = false;
  }
}
if (!usable) {
  console.error(usage);
  process.exit(2);
}

const problems = [];

/** Each line of `text` with whether it sits inside a code fence; the fence lines themselves count as inside. */
function withFences(text) {
  let fenced = false;
  return text.split('\n').map((line) => {
    const fence = line.startsWith('```');
    if (fence) {
      fenced = !fenced;
    }
    return { line, fenced: fenced || fence };
  });
}

/** Returns the body of `## <heading>` up to the next level-2 heading, outside code fences. */
function section(text, heading, file) {
  const lines = withFences(text);
  const isHeading = (l) => !l.fenced && l.line.startsWith('## ');
  const start = lines.findIndex((l) => isHeading(l) && l.line.trim() === `## ${heading}`) + 1;
  if (start === 0) {
    problems.push(`${file}: no "## ${heading}" section`);
    return '';
  }
  const next = lines.findIndex((l, i) => i >= start && isHeading(l));
  return lines
    .slice(start, next === -1 ? lines.length : next)
    .map((l) => l.line)
    .join('\n')
    .trim();
}

function title(text, file) {
  const match = /^# (.+)$/m.exec(text);
  if (!match) {
    problems.push(`${file}: no title`);
    return file;
  }
  return match[1].trim();
}

/** GitHub's heading anchor. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- ]/gu, '')
    .replace(/ /g, '-');
}

/** The blueprint's title and conventions, the docs its composition lists that this project includes, and its examples. */
function fromStack(stackPath) {
  const stackText = readFileSync(stackPath, 'utf8');
  const stackTitle = title(stackText, stackPath);
  const entries = [...section(stackText, 'Composition', stackPath).matchAll(/^- \[[^\]]+\]\(([^)#\s]+\.md)\)( — optional(?: \(([a-z0-9-]+)\))?)?$/gm)].map(
    (m) => ({ link: m[1], optional: m[2] !== undefined, name: m[3] ?? basename(m[1], '.md') })
  );
  if (entries.length === 0) {
    problems.push(`${stackPath}: "## Composition" lists no doc`);
  }
  for (const name of opted) {
    if (!entries.some((e) => e.optional && e.name === name)) {
      problems.push(`--with ${name}: not an optional entry of ${stackPath}`);
    }
  }
  const examples = [...section(stackText, 'Examples', stackPath).matchAll(/^- \[[^\]]+\]\(([^)#\s]+\.md)\)/gm)];
  return {
    kind: stackTitle,
    source: "skill's blueprint for that stack",
    head: [{ title: stackTitle, body: section(stackText, 'Conventions', stackPath) }],
    docs: entries.filter((e) => !e.optional || opted.has(e.name)).map((e) => resolve(dirname(stackPath), e.link)),
    examples: examples.map((m) => resolve(dirname(stackPath), m[1]))
  };
}

function fail() {
  console.error(problems.join('\n'));
  process.exit(1);
}

const { kind, source, head, docs, examples } = composing
  ? { kind: args[1], source: 'docs it was built from', head: [], docs: args.slice(2).map((doc) => resolve(doc)), examples: [] }
  : fromStack(args[0]);

if (listing) {
  if (problems.length > 0) {
    fail();
  }
  process.stdout.write(`Docs: ${docs.join(', ')}\nExamples: ${examples.join(', ') || 'none'}\n`);
  process.exit(0);
}

const parts = [...head];
for (const docPath of docs) {
  const text = readFileSync(docPath, 'utf8');
  parts.push({ title: title(text, docPath), body: section(text, 'Conventions', docPath) });
}

const out = [
  '# Coding Conventions',
  '',
  `How this project is built and how to change it: ${/^[AEIOU]/i.test(kind) ? 'an' : 'a'} ${kind} project, following the`,
  `\`apply-stack-conventions\` ${source}. It is the working guide for everyone who changes the code, people and agents`,
  'alike. The code follows every rule here; a change that breaks one changes this file in the same commit.',
  '',
  '## Contents',
  '',
  ...parts.map((p) => `- [${p.title}](#${slug(p.title)})`),
  ''
];
for (const p of parts) {
  out.push(`## ${p.title}`, '', p.body, '');
}
const result = out.join('\n');

// Links must resolve inside the assembled file.
const prose = withFences(result).filter((l) => !l.fenced);
const anchors = new Set(
  prose
    .map((l) => /^#{1,6} (.+)$/.exec(l.line))
    .filter(Boolean)
    .map((m) => slug(m[1]))
);
for (const { line } of prose) {
  for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^https?:/.test(target)) {
      continue;
    }
    if (!target.startsWith('#')) {
      problems.push(`link to a file outside the project: ${target}`);
    } else if (!anchors.has(target.slice(1))) {
      problems.push(`anchor that does not resolve: ${target}`);
    }
  }
}

if (problems.length > 0) {
  fail();
}
process.stdout.write(result);
