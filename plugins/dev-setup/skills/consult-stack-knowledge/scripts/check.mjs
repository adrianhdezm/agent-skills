#!/usr/bin/env node
// Every check of the knowledge base, after any change to its docs: run it and fix what it reports.
//
//   node check.mjs [--check]
//
// It rebuilds references/graph.json and checks the docs against their frontmatter (build-graph.mjs; with --check it
// writes nothing and also fails when graph.json is stale, the mode to run before committing), assembles every
// blueprint's conventions bare and with every optional group picked (assemble-conventions.mjs, which fails on a missing
// section or a link that would not resolve in a project), and checks that knowledge flows one way
// (check-knowledge-flow.mjs). Each failure names the doc and what to change; where a fact belongs is in
// references/catalog.md. It exits non-zero when any check fails.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraph } from './lib/graph.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes('--check');
const failures = [];

function run(label, script, args = []) {
  const result = spawnSync(process.execPath, [join(here, script), ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${label}\n${(result.stderr || result.stdout).trim().replace(/^/gm, '  ')}`);
  }
  return result;
}

run('graph', 'build-graph.mjs', checkOnly ? ['--check'] : []);

const graph = loadGraph(join(here, '..', 'references'));
for (const stack of Object.values(graph.stacks)) {
  run(`assembly: ${stack.file}`, 'assemble-conventions.mjs', [stack.path]);
  const groups = Object.keys(stack.optional);
  if (groups.length > 0) {
    run(`assembly: ${stack.file} with ${groups.join(', ')}`, 'assemble-conventions.mjs', [stack.path, ...groups.flatMap((g) => ['--with', g])]);
  }
}

run('knowledge flow', 'check-knowledge-flow.mjs');

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  console.error(`\n${failures.length} ${failures.length === 1 ? 'check' : 'checks'} failed`);
  process.exit(1);
}
console.log(`all checks pass: the graph${checkOnly ? ' is current' : ' is written'}, ${Object.keys(graph.stacks).length} blueprints assemble, knowledge flows one way`);
