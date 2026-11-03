// The knowledge graph behind the docs: every doc's frontmatter (its type and edges), the catalog's order, each
// blueprint's composition and Starter parts, and the files each doc claims. Scripts load it from the docs with
// `loadGraph`, so the docs stay the source of truth; `references/graph.json` is the same graph written out for reading
// and diffing. The prose repeats some edges for readers (a Realises line, a catalog row, a Composition, the Stacks
// table of SKILL.md); build-graph.mjs fails when the two disagree.
//
// The references directory is an Open Knowledge Format (OKF v0.2) bundle: every doc is a concept with YAML frontmatter
// whose `type` names its layer (TYPES below), `title` is its H1 and `description` its catalog row; `index.md` and
// `log.md` are reserved and never docs. OKF's own optional fields are read here and checked by build-graph.mjs:
// `resource` (the upstream project), `sources` (each `{ id, resource, title }`, cited in the body by `[^id]`
// footnotes), `stale_after` (when to re-check the doc against its sources), `status` (draft | stable | deprecated), and
// `generated` / `verified` (`{ by, at }` with an OKF actor: `human:<id>`, `process:<id>` or `<producer>/<version>`).
//
// Frontmatter is a small YAML subset: `key: scalar`, `key: [flow, list]` and `key: { flow: map }` (nestable), one
// level of indented `key:` maps, and one level of `- ` lists whose items are scalars, flow values or `key: value` maps.
// A value starting with a YAML indicator (`@`, a backtick, `!`, `&`, `*`, `%`, `|`, `>`, a bracket or `#`), or holding
// `: ` or ` #`, is quoted, `'@angular/'`, since YAML (and GitHub's rendering) rejects or misreads it bare; the parser
// refuses it unquoted. Fields by
// kind:
//   concept      always: true on the one every project has (code style)
//   technology   role (toolchain | runtime | framework | service | library | tooling: the composition order), realises
//                (concept ids, the same as its Realises line), detect (below), aliases (how its name appears in prose,
//                for the knowledge-flow check: a word, or a literal such as '@angular/'), family (a technology whose
//                vocabulary this doc may use: the Cloudflare products name Workers and Wrangler, NgRx names Angular)
//   integration  connects (the technologies it joins; a name with no doc is an external technology, known by name and
//                detected through this doc, which then needs its own detect), realises, detect (otherwise both ends
//                present means the seam is), unless (technologies whose presence means the seam is not used: Hono +
//                Drizzle once React Router owns the data)
//   stack        technologies (the required ones), optional (group → the technologies it adds; a group is a row's
//                `Optional (--with)` entry in SKILL.md), requires (group → the groups it needs), concepts (concepts the
//                stack is built around that none of its technologies realises: REST API for the Hono Worker)
// `detect` holds files (globs over paths, a trailing `/` for a directory), dependencies (any package.json's
// dependencies or devDependencies), manifest (key paths in package.json such as `engines.node`), scripts (regexes over
// script values) and fileContains (`<file>=<needle>`). A project is scanned three levels deep, skipping build output,
// so a workspace's packages count.
//
// The closure of a set of technologies is the always-on concepts, the concepts its technologies and integrations
// realise, and every integration whose ends are all present and no `unless` rules out; a blueprint's Composition is the
// closure of its technologies with every group picked (build-graph.mjs says how optional marks are checked).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

export const LAYERS = {
  architecture: 'concept',
  technologies: 'technology',
  integrations: 'integration',
  stacks: 'stack'
};
const DIRS = Object.fromEntries(Object.entries(LAYERS).map(([dir, kind]) => [kind, dir]));
/** The OKF `type` each kind's docs carry. */
export const TYPES = {
  concept: 'Architecture Concept',
  technology: 'Technology',
  integration: 'Integration',
  stack: 'Stack Blueprint'
};
/** Filenames OKF reserves at every level: never docs. */
export const RESERVED = new Set(['index.md', 'log.md']);
export const STATUSES = ['draft', 'stable', 'deprecated'];
export const ROLE_ORDER = ['toolchain', 'runtime', 'framework', 'service', 'library', 'tooling'];

// --- frontmatter -------------------------------------------------------------------------------------------------

function parseFlow(text) {
  let i = 0;
  function value() {
    skip();
    if (text[i] === '[' || text[i] === '{') {
      const map = text[i] === '{';
      const close = map ? '}' : ']';
      i++;
      const out = map ? {} : [];
      skip();
      while (text[i] !== close) {
        if (i >= text.length) {
          throw new Error(`unterminated "${close}" in ${text}`);
        }
        if (map) {
          const key = /^([A-Za-z][\w-]*): /.exec(text.slice(i));
          if (!key) {
            throw new Error(`cannot read a key at "${text.slice(i)}" in ${text}`);
          }
          i += key[0].length;
          out[key[1]] = value();
        } else {
          out.push(value());
        }
        skip();
        if (text[i] === ',') {
          i++;
          skip();
        }
      }
      i++;
      return out;
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
          return out;
        }
        if (quote === '"' && text[i] === '\\') {
          i++;
        }
        out += text[i++];
      }
      throw new Error(`unterminated quote in ${text}`);
    }
    let out = '';
    while (i < text.length && !',]}'.includes(text[i])) {
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

/** A value YAML would reject or misread bare: GitHub, and any YAML parser, would not read it as written. */
function plain(raw) {
  if (/^[@`!&*%|>{}[\]#'"]/.test(raw)) {
    throw new Error(`"${raw}" must be quoted ('${raw}'): YAML cannot start an unquoted value with "${raw[0]}"`);
  }
  if (/: |:$/.test(raw)) {
    throw new Error(`"${raw}" must be quoted ('${raw}'): YAML reads ": " in an unquoted value as a key`);
  }
  if (/ #/.test(raw)) {
    throw new Error(`"${raw}" must be quoted ('${raw}'): YAML reads " #" in an unquoted value as a comment`);
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

/** A frontmatter value: a flow list or map, a quoted string, or a plain scalar. */
function readValue(raw) {
  return /^[[{'"]/.test(raw) ? parseFlow(raw) : scalar(plain(raw));
}

/** Writes a string as a YAML scalar, quoted only when it has to be. */
export function yamlString(value) {
  try {
    if (readValue(value) === value) {
      return value;
    }
  } catch {
    // quoted below
  }
  return `'${value.replace(/'/g, "''")}'`;
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
  const fail = (message) => {
    throw new Error(`${file}: ${message}`);
  };
  const read = (raw) => {
    try {
      return readValue(raw);
    } catch (error) {
      return fail(error.message);
    }
  };
  let block; // the top-level key whose indented lines follow
  let item; // the map of the current `- key: value` list item, and the indent of its keys
  let itemIndent;
  for (const line of text.slice(4, end).split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    const top = /^([A-Za-z][\w-]*):(?: (.*))?$/.exec(line);
    if (top) {
      block = top[2] === undefined ? top[1] : undefined;
      item = undefined;
      data[top[1]] = top[2] === undefined ? undefined : read(top[2]);
      continue;
    }
    if (block === undefined) {
      fail(`unexpected nesting at "${line}"`);
    }
    const dash = /^( +)- (.+)$/.exec(line);
    if (dash) {
      data[block] ??= [];
      if (!Array.isArray(data[block])) {
        fail(`a list item under the map "${block}": "${line}"`);
      }
      const pair = /^([A-Za-z][\w-]*): (.+)$/.exec(dash[2]);
      item = pair ? { [pair[1]]: read(pair[2]) } : undefined;
      itemIndent = dash[1].length + 2;
      data[block].push(item ?? read(dash[2]));
      continue;
    }
    const nested = /^( +)([A-Za-z][\w-]*): (.+)$/.exec(line);
    if (!nested) {
      fail(`cannot read frontmatter line "${line}"`);
    }
    if (item && nested[1].length === itemIndent) {
      item[nested[2]] = read(nested[3]);
      continue;
    }
    data[block] ??= {};
    if (Array.isArray(data[block])) {
      fail(`unexpected "${line}" in the list "${block}"`);
    }
    data[block][nested[2]] = read(nested[3]);
  }
  for (const key of Object.keys(data)) {
    data[key] ??= {};
  }
  return { data, body: text.slice(end + 5) };
}

// --- sources and lifecycle -----------------------------------------------------------------------------------------

const FOOTNOTE_DEFINITION = /^\[\^([\w-]+)\]: (.*)$/;

/** The labels of the `[^id]` markers in a body, and of its footnote definitions. */
export function footnotes(body) {
  const lines = proseLines(body);
  const definitions = lines.map((l) => FOOTNOTE_DEFINITION.exec(l)?.[1]).filter(Boolean);
  const markers = lines.filter((l) => !FOOTNOTE_DEFINITION.test(l)).flatMap((l) => [...l.matchAll(/\[\^([\w-]+)\]/g)].map((m) => m[1]));
  return { markers, definitions };
}

/** A body for reading outside the knowledge base: each `[^id]` becomes the source it names, as a link, and the footnote
 * definitions go. */
export function citeSources(text, sources = []) {
  const byId = new Map(sources.filter((s) => s.id).map((s) => [s.id, s]));
  return text
    .split('\n')
    .filter((l) => !FOOTNOTE_DEFINITION.test(l))
    .join('\n')
    .replace(/\[\^([\w-]+)\]/g, (marker, id) => {
      const source = byId.get(id);
      if (!source) {
        return marker;
      }
      const label = source.title ?? source.resource;
      return /^https?:/.test(source.resource) ? ` ([${label}](${source.resource}))` : ` (${label})`;
    })
    .trimEnd();
}

/** What a reader should know before relying on a doc: that it is deprecated, a draft, or past its `stale_after`. */
export function lifecycleNotes(node, now = new Date()) {
  const notes = [];
  if (node.status === 'deprecated' || node.status === 'draft') {
    notes.push(`${node.file} is ${node.status === 'draft' ? 'a draft' : 'deprecated'}`);
  }
  if (node.stale_after && now >= new Date(node.stale_after)) {
    notes.push(`${node.file} is past its stale_after (${node.stale_after}): re-check it against its sources`);
  }
  return notes;
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
    for (const file of docFiles(join(root, dir))) {
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
      if (data.type !== TYPES[kind]) {
        problems.push(`${dir}/${file}: frontmatter type is "${data.type ?? 'missing'}", expected "${TYPES[kind]}"`);
      }
      const heading = /^# (.+)$/m.exec(body)?.[1]?.trim();
      if (data.title !== heading) {
        problems.push(`${dir}/${file}: frontmatter title is "${data.title ?? 'missing'}" but the H1 is "${heading ?? 'missing'}": make them the same`);
      }
      const node = { id, kind, title: heading ?? id, file: `${dir}/${file}`, path, ...data };
      delete node.type;
      node.kind = kind;
      // OKF: a bare `verified` mapping is a one-element list.
      if (node.verified && !Array.isArray(node.verified)) {
        node.verified = [node.verified];
      }
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

/** The docs of a layer directory: its markdown files but the reserved ones, sorted. */
export function docFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !RESERVED.has(f))
    .sort();
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
  for (const stack of Object.values(graph.stacks).filter((s) => s.status !== 'deprecated')) {
    const universe =stackTechnologies(stack, Object.keys(stack.optional));
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
