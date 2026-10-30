#!/usr/bin/env node
// Assembles a project's coding-conventions.md from a stack blueprint and the docs its composition lists, or, for a
// combination no blueprint covers, from a title and the docs the project was built from.
//
//   node assemble-conventions.mjs <stack file> [--with <optional entry>]... > coding-conventions.md
//   node assemble-conventions.mjs --compose "<project kind>" <doc>... > coding-conventions.md
//
// The blueprint's "## Composition" section lists the technology and integration docs as a bulleted list of links, in
// the order their conventions appear. An entry ending in " — optional" is included only when its file's base name is
// passed with --with (`--with angular-fundamental-ngx`); one ending in " — optional (<group>)" when its group is, so
// `--with authentication` brings in every entry of that group.
// The output holds the stack's own "## Conventions" section first (none in --compose mode), then each doc's
// "## Conventions" section under the doc's title. It exits non-zero when a section is missing, when --with names no optional entry, or when the result
// would carry a relative link to a file (it lives in the project, not beside the skill) or an anchor that does not
// resolve.
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const composing = args[0] === '--compose';
const [stackPath, ...flags] = composing ? [] : args;
const usage = [
  'usage: assemble-conventions.mjs <stack file> [--with <optional entry>]...',
  '       assemble-conventions.mjs --compose "<project kind>" <doc>...'
].join('\n');
const badStack = !composing && (!stackPath || flags.length % 2 !== 0 || flags.some((flag, i) => i % 2 === 0 && flag !== '--with'));
if (badStack || (composing && args.length < 3)) {
  console.error(usage);
  process.exit(2);
}
const opted = new Set(flags.filter((_, i) => i % 2 === 1));

const problems = [];

/** Returns the body of `## <heading>` up to the next level-2 heading, outside code fences. */
function section(text, heading, file) {
  const lines = text.split('\n');
  let inFence = false;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) {
      inFence = !inFence;
    }
    if (inFence || !lines[i].startsWith('## ')) {
      continue;
    }
    if (start === -1 && lines[i].trim() === `## ${heading}`) {
      start = i + 1;
    } else if (start !== -1) {
      end = i;
      break;
    }
  }
  if (start === -1) {
    problems.push(`${file}: no "## ${heading}" section`);
    return '';
  }
  return lines.slice(start, end).join('\n').trim();
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

/** The blueprint's title and conventions, and the docs its composition lists that this project includes. */
function fromStack() {
  const stackText = readFileSync(stackPath, 'utf8');
  const stackTitle = title(stackText, stackPath);
  const entries = [
    ...section(stackText, 'Composition', stackPath).matchAll(/^- \[[^\]]+\]\(([^)#\s]+\.md)\)( — optional(?: \(([a-z0-9-]+)\))?)?$/gm)
  ].map((m) => ({ link: m[1], optional: m[2] !== undefined, name: m[3] ?? basename(m[1], '.md') }));
  if (entries.length === 0) {
    problems.push(`${stackPath}: "## Composition" lists no doc`);
  }
  for (const name of opted) {
    if (!entries.some((e) => e.optional && e.name === name)) {
      problems.push(`--with ${name}: not an optional entry of ${stackPath}`);
    }
  }
  const docs = entries.filter((e) => !e.optional || opted.has(e.name)).map((e) => resolve(dirname(stackPath), e.link));
  return {
    kind: stackTitle,
    source: "skill's blueprint for that stack",
    head: [{ title: stackTitle, body: section(stackText, 'Conventions', stackPath) }],
    docs
  };
}

const { kind, source, head, docs } = composing
  ? { kind: args[1], source: 'docs it was built from', head: [], docs: args.slice(2).map((doc) => resolve(doc)) }
  : fromStack();

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
const anchors = new Set();
let fenced = false;
for (const line of result.split('\n')) {
  if (line.startsWith('```')) {
    fenced = !fenced;
  }
  const heading = !fenced && /^#{1,6} (.+)$/.exec(line);
  if (heading) {
    anchors.add(slug(heading[1]));
  }
}
const prose = result.replace(/```[\s\S]*?```/g, '');
for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
  if (/^https?:/.test(target)) {
    continue;
  }
  if (!target.startsWith('#')) {
    problems.push(`link to a file outside the project: ${target}`);
  } else if (!anchors.has(target.slice(1))) {
    problems.push(`anchor that does not resolve: ${target}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
process.stdout.write(result);
