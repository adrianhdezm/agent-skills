#!/usr/bin/env node
// Assembles a project's coding-conventions.md from a stack blueprint and the docs its composition lists, or, for a
// combination no blueprint covers, from a title and the docs the project was built from.
//
//   node assemble-conventions.mjs <stack file> [--with <optional entry>]... [--out <file>] [--list]
//   node assemble-conventions.mjs --compose "<project kind>" [--example <example>]... [--out <file>] [--list] <doc>...
//
// The blueprint's "## Composition" section lists the architecture, technology and integration docs as a bulleted list
// of links, in the order their conventions appear. An entry ending in " — optional" is included only when its file's
// base name is passed with --with (`--with angular-fundamental-ngx`); one ending in " — optional (<group>)" when its
// group is, so `--with authentication` brings in every entry of that group. Its "## Examples" section lists the
// examples a fresh scaffold starts with, an example marked " — optional (<group>)" only when its group is picked, and the "ports" row of its "## Required values" the ports it binds.
// The conventions hold the stack's own "## Conventions" section first (none in --compose mode, where the project kind is
// a noun phrase such as "Hono API on Node"), then each doc's "## Conventions" section under the doc's title. Without
// --out they go to stdout. With --out they are written to that file, and stdout gets the hand-off block the skill
// returns: Stack, Blueprint, Docs and Examples (absolute paths, in composition order), Ports and Conventions; the caller
// adds Gaps and Found. --list prints the same block without assembling anything.
// It exits non-zero when a section is missing, when --with names no optional entry, or when the conventions would carry
// a relative link to a file (they live in the project, not beside the skill) or an anchor that does not resolve.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const usage = [
  'usage: assemble-conventions.mjs <stack file> [--with <optional entry>]... [--out <file>] [--list]',
  '       assemble-conventions.mjs --compose "<project kind>" [--example <example>]... [--out <file>] [--list] <doc>...'
].join('\n');
const composing = args[0] === '--compose';
const opted = new Set();
const composedDocs = [];
const composedExamples = [];
let listing = false;
let outFile;
let usable = composing ? args.length >= 3 : args.length >= 1 && !args[0].startsWith('--');
for (let i = composing ? 2 : 1; usable && i < args.length; i++) {
  const value = args[i + 1];
  if (args[i] === '--list') {
    listing = true;
  } else if (args[i] === '--out' && value !== undefined) {
    outFile = resolve(value);
    i++;
  } else if (args[i] === '--with' && !composing && value !== undefined) {
    opted.add(value);
    i++;
  } else if (args[i] === '--example' && composing && value !== undefined) {
    composedExamples.push(resolve(value));
    i++;
  } else if (composing && !args[i].startsWith('--')) {
    composedDocs.push(resolve(args[i]));
  } else {
    usable = false;
  }
}
if (!usable || (composing && composedDocs.length === 0)) {
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
  const examples = [...section(stackText, 'Examples', stackPath).matchAll(/^- \[[^\]]+\]\(([^)#\s]+\.md)\)(?:[^\n]*? — optional \(([a-z0-9-]+)\))?/gm)].filter(
    (m) => m[2] === undefined || opted.has(m[2])
  );
  const ports = /^\| ports +\| (.+?) *\|$/m.exec(section(stackText, 'Required values', stackPath));
  return {
    kind: stackTitle,
    stack: `${stackTitle} · with: ${[...opted].join(', ') || 'none'}`,
    blueprint: resolve(stackPath),
    ports: ports ? ports[1] : 'none',
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

const { kind, stack, blueprint, ports, source, head, docs, examples } = composing
  ? {
      kind: args[1],
      stack: `Composed: ${args[1]}`,
      blueprint: 'none',
      ports: "the docs' own; check each",
      source: 'docs it was built from',
      head: [],
      docs: composedDocs,
      examples: composedExamples
    }
  : fromStack(args[0]);

/** The hand-off block, without the Gaps and Found lines only the caller can write. */
function handOff(conventions) {
  return [
    `Stack: ${stack}`,
    `Blueprint: ${blueprint}`,
    `Docs: ${docs.join(', ')}`,
    `Examples: ${examples.join(', ') || 'none'}`,
    `Ports: ${ports}`,
    ...(conventions ? [`Conventions: ${conventions}`] : [])
  ].join('\n');
}

if (listing && !outFile) {
  if (problems.length > 0) {
    fail();
  }
  process.stdout.write(`${handOff()}\n`);
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
if (outFile) {
  writeFileSync(outFile, result);
  process.stdout.write(`${handOff(outFile)}\n`);
} else {
  process.stdout.write(result);
}
