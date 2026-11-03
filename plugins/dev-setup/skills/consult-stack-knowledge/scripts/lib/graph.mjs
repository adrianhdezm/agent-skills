// The knowledge graph behind the docs: every doc's frontmatter (its kind and edges), the catalog's order, each
// blueprint's composition and Starter parts, and the files each doc claims. Scripts load it from the docs with `loadGraph`, so the docs
// stay the source of truth; `references/graph.json` is the same graph written out for reading and diffing.
//
// Frontmatter is a small YAML subset: `key: scalar`, `key: [flow, list]` (nestable), and one level of indented
// `key:` maps. Fields by kind:
//   concept      always (true for the one every project has)
//   technology   role (toolchain | runtime | framework | service | library | tooling), realises, detect, aliases, family
//   integration  connects (the technologies it joins; one without a doc is an external technology), realises, detect,
//                unless (technologies whose presence means the seam is not used)
//   stack        technologies, optional (group → technologies), requires (group → groups), concepts (the ones its
//                technologies do not realise but the stack is built around)
// `detect` holds files (globs, a trailing `/` for a directory), dependencies, manifest (key paths in package.json),
// scripts (regexes over script values) and fileContains (`<file>=<needle>`).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

export const LAYERS = {
  architecture: 'concept',
  technologies: 'technology',
  integrations: 'integration',
  stacks: 'stack'
};
const DIRS = Object.fromEntries(Object.entries(LAYERS).map(([dir, kind]) => [kind, dir]));
export const ROLE_ORDER = ['toolchain', 'runtime', 'framework', 'service', 'library', 'tooling'];

// --- frontmatter -------------------------------------------------------------------------------------------------

function parseFlow(text) {
  let i = 0;
  function value() {
    skip();
    if (text[i] === '[') {
      i++;
      const items = [];
      skip();
      while (text[i] !== ']') {
        items.push(value());
        skip();
        if (text[i] === ',') {
          i++;
          skip();
        }
      }
      i++;
      return items;
    }
    if (text[i] === "'" || text[i] === '"') {
      const quote = text[i++];
      let out = '';
      while (i < text.length) {
        if (text[i] === quote) {
          if (quote === "'" && text[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        out += text[i++];
      }
      return out;
    }
    let out = '';
    while (i < text.length && !',]'.includes(text[i])) {
      out += text[i++];
    }
    return scalar(plain(out.trim()));
  }
  function skip() {
    while (i < text.length && text[i] === ' ') {
      i++;
    }
  }
  const result = value();
  skip();
  if (i < text.length) {
    throw new Error(`unexpected "${text.slice(i)}" in ${text}`);
  }
  return result;
}

/** YAML's indicator characters cannot start an unquoted value: GitHub, and any YAML parser, rejects the frontmatter. */
function plain(raw) {
  if (/^[@`!&*%|>{}[\]#]/.test(raw)) {
    throw new Error(`"${raw}" must be quoted ('${raw}'): YAML cannot start an unquoted value with "${raw[0]}"`);
  }
  return raw;
}

function scalar(raw) {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return raw;
}

/** Splits a doc into its frontmatter data and body. */
export function parseFrontmatter(text, file = '') {
  if (!text.startsWith('---\n')) {
    return { data: {}, body: text };
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error(`${file}: unterminated frontmatter`);
  }
  const data = {};
  let current = data;
  for (const line of text.slice(4, end).split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    const match = /^( *)([A-Za-z][\w-]*):(?: (.*))?$/.exec(line);
    if (!match) {
      throw new Error(`${file}: cannot read frontmatter line "${line}"`);
    }
    const [, indent, key, raw] = match;
    const read = (value) => {
      try {
        return value.startsWith('[') ? parseFlow(value) : /^'.*'$/.test(value) ? value.slice(1, -1) : scalar(plain(value));
      } catch (error) {
        throw new Error(`${file}: ${error.message}`);
      }
    };
    if (indent === '') {
      if (raw === undefined) {
        current = data[key] = {};
      } else {
        current = data;
        data[key] = read(raw);
      }
    } else if (current === data || raw === undefined) {
      throw new Error(`${file}: unexpected nesting at "${line}"`);
    } else {
      current[key] = read(raw);
    }
  }
  return { data, body: text.slice(end + 5) };
}

// --- markdown helpers ----------------------------------------------------------------------------------------------

/** Lines outside code fences. */
export function proseLines(text) {
  let fenced = false;
  return text.split('\n').filter((line) => {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
}

/** The body of a `## <heading>` section (or `### <heading>` when `level` is 3), without its sub-sections' markers. */
export function section(text, heading, level = 2) {
  const marker = `${'#'.repeat(level)} `;
  const lines = proseLinesWithFences(text);
  const start = lines.findIndex((l) => !l.fenced && l.line.trim() === `${marker}${heading}`) + 1;
  if (start === 0) {
    return undefined;
  }
  const next = lines.findIndex(
    (l, i) => i >= start && !l.fenced && /^#{1,6} /.test(l.line) && l.line.indexOf(' ') <= level
  );
  return lines
    .slice(start, next === -1 ? lines.length : next)
    .map((l) => l.line)
    .join('\n')
    .trim();
}

function proseLinesWithFences(text) {
  let fenced = false;
  return text.split('\n').map((line) => {
    const fence = line.trimStart().startsWith('```');
    if (fence) {
      fenced = !fenced;
    }
    return { line, fenced: fenced || fence };
  });
}

/** The headings of a text, as `{ level, title }`, outside code fences. */
export function headings(text) {
  return proseLines(text)
    .map((l) => /^(#{1,6}) (.+)$/.exec(l))
    .filter(Boolean)
    .map((m) => ({ level: m[1].length, title: m[2].trim() }));
}

/** The rows of every table in `text`, each a list of trimmed cells, header and rule lines left out. */
export function tableRows(text) {
  return proseLines(text)
    .filter((l) => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) => l.slice(1, l.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim()))
    .filter((cells) => cells.length > 1);
}

/** The ids of docs a text links to, by layer, in order. */
export function linkedIds(text) {
  return [...text.matchAll(/\]\((?:\.\.\/)?([a-z]+)\/([a-z0-9-]+)\.md\)/g)].map((m) => ({ layer: m[1], id: m[2] }));
}

// --- the graph ---------------------------------------------------------------------------------------------------

/** Loads the graph from the docs under `root` (the references directory). */
export function loadGraph(root) {
  root = resolve(root);
  const graph = { root, concepts: {}, technologies: {}, integrations: {}, stacks: {}, order: {} };
  const byKind = { concept: graph.concepts, technology: graph.technologies, integration: graph.integrations, stack: graph.stacks };
  const problems = [];
  for (const [dir, kind] of Object.entries(LAYERS)) {
    for (const file of readdirSync(join(root, dir)).filter((f) => f.endsWith('.md')).sort()) {
      const id = basename(file, '.md');
      const path = join(root, dir, file);
      const text = readFileSync(path, 'utf8');
      let parsed;
      try {
        parsed = parseFrontmatter(text, `${dir}/${file}`);
      } catch (error) {
        problems.push(error.message);
        continue;
      }
      const { data, body } = parsed;
      if (data.kind !== kind) {
        problems.push(`${dir}/${file}: frontmatter kind is "${data.kind ?? 'missing'}", expected "${kind}"`);
      }
      const title = /^# (.+)$/m.exec(body)?.[1]?.trim() ?? id;
      const node = { id, kind, title, file: `${dir}/${file}`, path, ...data };
      delete node.kind;
      node.kind = kind;
      if (kind === 'technology' || kind === 'integration') {
        node.realises ??= [];
        node.owns = claimedPaths(body);
      }
      if (kind === 'integration') {
        node.connects ??= [];
        node.unless ??= [];
      }
      if (kind === 'stack') {
        node.technologies ??= [];
        node.optional ??= {};
        node.requires ??= {};
        node.concepts ??= [];
        node.composition = compositionOf(body, 'Composition');
        node.starter = starterOf(body);
        node.owns = claimedPaths(body);
      }
      byKind[kind][id] = node;
    }
  }
  // Technologies named by an integration but without a doc are external: known by name, detected through the
  // integration, never listed as a doc.
  for (const integration of Object.values(graph.integrations)) {
    for (const tech of integration.connects) {
      if (!graph.technologies[tech]) {
        graph.technologies[tech] = { id: tech, kind: 'technology', external: true, title: tech, realises: [], role: 'library', owns: [], detect: undefined, via: integration.id };
      }
    }
  }
  // The catalog's order is the order technologies and concepts are composed in.
  const catalog = readFileSync(join(root, 'catalog.md'), 'utf8');
  const listed = linkedIds(catalog);
  for (const [layer, kind] of Object.entries(LAYERS)) {
    if (kind === 'stack') {
      continue;
    }
    const inCatalog = listed.filter((l) => l.layer === layer).map((l) => l.id);
    const all = Object.keys(byKind[kind]).filter((id) => !byKind[kind][id].external);
    graph.order[kind] = [...inCatalog.filter((id) => all.includes(id)), ...all.filter((id) => !inCatalog.includes(id)).sort()];
  }
  graph.order.technology.push(...Object.values(graph.technologies).filter((t) => t.external).map((t) => t.id));
  graph.order.stack = Object.keys(graph.stacks);
  graph.problems = problems;
  return graph;
}

function compositionOf(body, heading) {
  const list = section(body, heading) ?? '';
  return [...list.matchAll(/^- \[[^\]]+\]\((?:\.\.\/)?([a-z]+)\/([a-z0-9-]+)\.md\)(?:[^\n]*? — optional(?: \(([a-z0-9-]+)\))?)?/gm)].map((m) => ({
    layer: m[1],
    kind: LAYERS[m[1]],
    id: m[2],
    optional: m[0].includes(' — optional'),
    group: m[3] ?? (m[0].includes(' — optional') ? m[2] : undefined)
  }));
}

/** A blueprint's Starter parts: each `### ` heading of its "## Starter" section, with the group it needs when the heading
 * says `with \`<group>\``. A Starter without parts is one part, the whole section. */
export function starterOf(body) {
  const text = section(body, 'Starter');
  if (text === undefined) {
    return undefined;
  }
  return headings(text)
    .filter((h) => h.level === 3)
    .map((h) => ({ title: h.title, group: /\bwith `([a-z0-9-]+)`/i.exec(h.title)?.[1] }));
}

/** The Starter parts a project with these groups starts from. */
export function starterParts(stack, groups) {
  return (stack.starter ?? []).filter((part) => !part.group || groups.includes(part.group)).map((part) => part.title);
}

/** The paths a doc claims: the first column of its "Where it lives" and "Layout" tables, and the files its Required values name. */
function claimedPaths(body) {
  const claims = [];
  const add = (source, text) => {
    for (const row of tableRows(text)) {
      for (const [, span] of row[0].matchAll(/`([^`]+)`/g)) {
        if (/[./]/.test(span) && !/[ ():]/.test(span)) {
          claims.push({ path: span, holds: row[1].replace(/\s+/g, ' '), source });
        }
      }
    }
  };
  const lives = section(body, 'Where it lives');
  if (lives) {
    add('Where it lives', lives);
  }
  const layout = section(body, 'Layout', 3);
  if (layout) {
    add('Layout', layout);
  }
  const required = section(body, 'Required values');
  if (required) {
    for (const row of tableRows(required)) {
      for (const [, span] of row[0].matchAll(/`([^`]+)`/g)) {
        if (/^[\w.@/*{}-]+\.[a-z]+$/i.test(span) || span.endsWith('/')) {
          claims.push({ path: span, holds: row[1].replace(/\s+/g, ' '), source: 'Required values' });
        }
      }
    }
  }
  return claims;
}

export function docOf(graph, kind, id) {
  const table = { concept: graph.concepts, technology: graph.technologies, integration: graph.integrations, stack: graph.stacks }[kind];
  return table?.[id];
}

// --- closure -----------------------------------------------------------------------------------------------------

/**
 * Everything a set of technologies brings: the integrations whose every end is present and no `unless` rules out,
 * the concepts they realise (plus the always-on ones and `extraConcepts`).
 */
export function closure(graph, technologies, { extraConcepts = [] } = {}) {
  const techs = new Set(technologies);
  const integrations = graph.order.integration.filter((id) => {
    const i = graph.integrations[id];
    return i.connects.every((t) => techs.has(t)) && !i.unless.some((t) => techs.has(t));
  });
  const concepts = new Set(graph.order.concept.filter((id) => graph.concepts[id].always));
  for (const id of techs) {
    for (const c of graph.technologies[id]?.realises ?? []) {
      concepts.add(c);
    }
  }
  for (const id of integrations) {
    for (const c of graph.integrations[id].realises) {
      concepts.add(c);
    }
  }
  for (const c of extraConcepts) {
    concepts.add(c);
  }
  return {
    technologies: graph.order.technology.filter((id) => techs.has(id)),
    concepts: graph.order.concept.filter((id) => concepts.has(id)),
    integrations
  };
}

/** The groups a stack brings in for the ones picked, following `requires`. */
export function expandGroups(stack, groups) {
  const picked = new Set();
  const added = [];
  const visit = (g, because) => {
    if (picked.has(g)) {
      return;
    }
    picked.add(g);
    if (because) {
      added.push({ group: g, because });
    }
    for (const needed of stack.requires[g] ?? []) {
      visit(needed, g);
    }
  };
  for (const g of groups) {
    visit(g);
  }
  return { groups: Object.keys(stack.optional).filter((g) => picked.has(g)), added };
}

export function stackTechnologies(stack, groups) {
  const techs = new Set(stack.technologies);
  for (const g of groups) {
    for (const t of stack.optional[g] ?? []) {
      techs.add(t);
    }
  }
  return techs;
}

export function stackClosure(graph, stack, groups) {
  return closure(graph, stackTechnologies(stack, groups), { extraConcepts: stack.concepts });
}

/** The docs of a closure in composition order: the always-on concepts, the toolchain, the concepts, then each
 * technology by role followed by the integrations it completes. */
export function orderDocs(graph, cl) {
  const docs = [];
  const emittedTechs = new Set();
  const emittedIntegrations = new Set();
  const push = (kind, id) => docs.push({ kind, id });
  for (const id of cl.concepts.filter((c) => graph.concepts[c].always)) {
    push('concept', id);
  }
  const techsByRole = (role) => cl.technologies.filter((t) => (graph.technologies[t].role ?? 'library') === role && !graph.technologies[t].external);
  const emitTech = (id) => {
    push('technology', id);
    emittedTechs.add(id);
    for (const i of cl.integrations) {
      if (!emittedIntegrations.has(i) && graph.integrations[i].connects.every((t) => emittedTechs.has(t) || graph.technologies[t].external)) {
        push('integration', i);
        emittedIntegrations.add(i);
      }
    }
  };
  techsByRole('toolchain').forEach(emitTech);
  for (const id of cl.concepts.filter((c) => !graph.concepts[c].always)) {
    push('concept', id);
  }
  for (const role of ROLE_ORDER.filter((r) => r !== 'toolchain')) {
    techsByRole(role).forEach(emitTech);
  }
  for (const i of cl.integrations.filter((i) => !emittedIntegrations.has(i))) {
    push('integration', i);
  }
  return docs;
}

// --- detection -----------------------------------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.angular', '.cache', '.wrangler', 'data', 'migrations']);

/** Walks a project (three levels deep, skipping build output) and returns its files, directories and manifests. */
export function scanProject(dir, depth = 3) {
  const files = [];
  const dirs = [];
  const manifests = [];
  const walk = (current, level) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const rel = relative(dir, path);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.storybook')) {
          continue;
        }
        dirs.push(rel);
        if (level < depth) {
          walk(path, level + 1);
        }
      } else {
        files.push(rel);
        if (entry.name === 'package.json') {
          try {
            manifests.push({ path: rel, json: JSON.parse(readFileSync(path, 'utf8')) });
          } catch {
            // an unreadable manifest is not evidence
          }
        }
      }
    }
  };
  walk(dir, 1);
  return { dir, files, dirs, manifests };
}

function globToRegex(glob) {
  return new RegExp(`(^|/)${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
}

function matchDetect(detect, scan) {
  const evidence = [];
  for (const glob of detect.files ?? []) {
    const isDir = glob.endsWith('/');
    const re = globToRegex(isDir ? glob.slice(0, -1) : glob);
    const hit = (isDir ? scan.dirs : scan.files).find((p) => re.test(p));
    if (hit) {
      evidence.push(hit);
    }
  }
  for (const dep of detect.dependencies ?? []) {
    for (const { path, json } of scan.manifests) {
      if (json.dependencies?.[dep] !== undefined || json.devDependencies?.[dep] !== undefined) {
        evidence.push(`${dep} in ${path}`);
      }
    }
  }
  for (const keyPath of detect.manifest ?? []) {
    for (const { path, json } of scan.manifests) {
      const value = keyPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), json);
      if (value !== undefined) {
        evidence.push(`${keyPath} in ${path}`);
      }
    }
  }
  for (const pattern of detect.scripts ?? []) {
    const re = new RegExp(pattern);
    for (const { path, json } of scan.manifests) {
      const name = Object.keys(json.scripts ?? {}).find((s) => re.test(json.scripts[s]));
      if (name) {
        evidence.push(`script ${name} in ${path}`);
      }
    }
  }
  for (const spec of detect.fileContains ?? []) {
    const [file, needle] = spec.split('=');
    for (const rel of scan.files.filter((p) => p === file || p.endsWith(`/${file}`))) {
      if (readFileSync(join(scan.dir, rel), 'utf8').includes(needle)) {
        evidence.push(`${needle} in ${rel}`);
      }
    }
  }
  return evidence;
}

/** The technologies a project shows, with the evidence for each. */
export function detectTechnologies(graph, scan) {
  const found = new Map();
  for (const tech of Object.values(graph.technologies)) {
    if (!tech.detect) {
      continue;
    }
    const evidence = matchDetect(tech.detect, scan);
    if (evidence.length > 0) {
      found.set(tech.id, evidence);
    }
  }
  for (const integration of Object.values(graph.integrations)) {
    if (!integration.detect) {
      continue;
    }
    const evidence = matchDetect(integration.detect, scan);
    if (evidence.length > 0) {
      for (const tech of integration.connects) {
        found.set(tech, [...(found.get(tech) ?? []), ...evidence]);
      }
    }
  }
  return found;
}

/**
 * The blueprint a set of technologies is, if one fits: every detected technology belongs to the stack, and whatever
 * required technology is missing is toolchain or tooling (reported, not disqualifying). Picks the groups whose
 * technologies are present.
 */
export function matchStack(graph, technologies) {
  const techs = new Set(technologies);
  const candidates = [];
  for (const stack of Object.values(graph.stacks)) {
    const universe = stackTechnologies(stack, Object.keys(stack.optional));
    if (![...techs].every((t) => universe.has(t))) {
      continue;
    }
    const missing = stack.technologies.filter((t) => !techs.has(t));
    const disqualifying = missing.filter((t) => !['toolchain', 'tooling'].includes(graph.technologies[t]?.role));
    if (disqualifying.length > 0) {
      continue;
    }
    const groups = Object.keys(stack.optional).filter((g) => stack.optional[g].some((t) => techs.has(t)));
    candidates.push({ stack, missing, groups, present: stack.technologies.filter((t) => techs.has(t)).length });
  }
  candidates.sort((a, b) => a.missing.length - b.missing.length || b.present - a.present || b.stack.technologies.length - a.stack.technologies.length);
  return candidates[0];
}

/** The current doc of a `{ kind, id }` entry. */
export function pathOf(graph, entry) {
  return join(graph.root, DIRS[entry.kind], `${entry.id}.md`);
}

export function exists(path) {
  return existsSync(path) && statSync(path).isFile();
}
