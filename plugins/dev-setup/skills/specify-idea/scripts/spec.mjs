// Reads docs/<slug>/02-spec.md into its status line, behaviours (B1…), acceptance criteria (B1.1…), releases and
// Mermaid diagrams.
//
// The one definition of the spec format that scripts read: check-spec.mjs here, build-review.mjs in plan-release and
// trace.mjs in verify-release all import it, so the three cannot drift apart.
//
//   ### B3: A teammate can vote for one place and change their vote.
//   - B3.1 Given an open poll, when a teammate votes for a place, then …
//     a continuation line is indented
//
// A heading or a criterion marked _(dropped)_ keeps its number and is skipped by coverage checks.
//
// Releases cut the behaviours into the order they ship; the plan and verification work one release at a time:
//
//   ## Releases
//
//   - **R1: First potluck**: B1, B2, B3 · a host can run one potluck end to end
//
// Diagrams are ```mermaid blocks. Each is read with the "## " section and "### " heading it sits under, so the checker
// can require a classDiagram under "## Domain" and a stateDiagram-v2 for each thing under "## Lifecycles":
//
//   ## Lifecycles
//
//   ### Slot
//
//   ```mermaid
//   stateDiagram-v2
//     [*] --> open : host adds a slot (B2)
//     open --> claimed : guest claims it (B3)
//   ```

export const BEHAVIOUR = /^###\s+(B\d+)\b:?\s*(.*)$/;
export const CRITERION = /^\s*-\s+(B\d+\.\d+)\s+(.*)$/;
export const RELEASE = /^\s*-\s+\*\*(R\d+)\b:?\s*(.*?)\*\*:?\s*(.*)$/;
const DROPPED = /_\(dropped\)_/;
const EXISTS = /_\(exists\)_/;

/**
 * @returns {{ status: string | null, behaviours: Array<{ id: string, title: string, dropped: boolean,
 *   exists: boolean, line: number, criteria: Array<{ id: string, text: string, dropped: boolean, line: number }> }>,
 *   releases: Array<{ id: string, name: string, covers: string[], goal: string, line: number }> | null,
 *   diagrams: Array<{ kind: string, section: string, heading: string | null, body: string, line: number }>,
 *   stray: Array<{ line: number, text: string, why: string }> }}
 */
export function parseSpec(text) {
  const behaviours = [];
  const stray = [];
  const diagrams = [];
  let releases = null;
  let inReleases = false;
  let section = "";
  let heading = null;
  let status = null;
  let current = null;
  let last = null;
  let fenced = false;
  let diagram = null;
  text.split("\n").forEach((line, i) => {
    const n = i + 1;
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      last = null;
      if (fenced && /^\s*```\s*mermaid\b/.test(line)) diagram = { kind: "", section, heading, body: "", line: n };
      else if (!fenced && diagram) {
        diagram.kind = (diagram.body.match(/^\s*(?:%%.*\n\s*)*([\w-]+)/) ?? [])[1] ?? "";
        diagrams.push(diagram);
        diagram = null;
      }
      return;
    }
    if (fenced) {
      if (diagram) diagram.body += `${line}\n`;
      return;
    }
    const s = line.match(/^Status:\s*(.*)$/);
    if (s && status === null) {
      status = s[1].trim();
      return;
    }
    const b = line.match(BEHAVIOUR);
    if (b) {
      current = {
        id: b[1],
        title: b[2].replace(DROPPED, "").replace(EXISTS, "").trim(),
        dropped: DROPPED.test(b[2]),
        exists: EXISTS.test(b[2]),
        line: n,
        criteria: []
      };
      behaviours.push(current);
      inReleases = false;
      heading = b[1];
      last = null;
      return;
    }
    if (/^#{1,6}\s/.test(line)) {
      if (/^#{1,6}\s+B\d+\b/.test(line)) stray.push({ line: n, text: line, why: 'a behaviour heading is "### B<n>: …"' });
      if (/^##\s/.test(line)) {
        section = line.replace(/^##\s+/, "").trim();
        heading = null;
        inReleases = /^Releases\b/.test(section);
      }
      if (/^###\s/.test(line)) heading = line.replace(/^###\s+/, "").trim();
      if (inReleases && releases === null) releases = [];
      current = null;
      last = null;
      return;
    }
    if (inReleases) {
      const r = line.match(RELEASE);
      if (r) {
        const [list, ...goal] = r[3].split("·");
        releases.push({ id: r[1], name: r[2].trim(), covers: [...list.matchAll(/\bB\d+\b/g)].map((m) => m[0]), goal: goal.join("·").trim(), line: n });
      } else if (/^\s*[-*+]\s/.test(line)) {
        stray.push({ line: n, text: line, why: 'a release is "- **R<n>: <name>**: B1, B2 · <goal>"' });
      }
      return;
    }
    const c = line.match(CRITERION);
    if (c) {
      if (!current) {
        stray.push({ line: n, text: line, why: "a criterion sits under its behaviour's ### heading" });
        last = null;
        return;
      }
      last = { id: c[1], text: c[2].replace(DROPPED, "").trim(), dropped: DROPPED.test(c[2]), line: n };
      current.criteria.push(last);
      return;
    }
    if (last && /^\s+\S/.test(line)) {
      last.text = `${last.text} ${line.trim()}`;
      return;
    }
    last = null;
    if (/^\s*(?:[*+]|\d+\.)\s+B\d+\.\d+\b/.test(line) || /^\s*B\d+\.\d+\s/.test(line)) {
      stray.push({ line: n, text: line, why: 'a criterion is a "- " bullet: "- B<n>.<m> Given …, when …, then …"' });
    }
  });
  return { status, behaviours, releases, diagrams, stray };
}

/** Which release each behaviour ships in: B -> R. Empty when the spec has no releases. */
export function releaseOf(spec) {
  return new Map((spec.releases ?? []).flatMap((r) => r.covers.map((b) => [b, r.id])));
}

/** The behaviours and criteria that coverage and tracing count: everything not marked _(dropped)_. */
export function live(spec) {
  return spec.behaviours
    .filter((b) => !b.dropped)
    .map((b) => ({ ...b, criteria: b.criteria.filter((c) => !c.dropped) }));
}

/** The class names a Mermaid classDiagram declares or relates, such as Potluck and Slot. */
export function classesOf(body) {
  const names = new Set();
  for (const line of body.split("\n")) {
    const decl = line.match(/^\s*class\s+([\w-]+)/);
    if (decl) names.add(decl[1]);
    const rel = line.match(/^\s*([\w-]+)\s*(?:"[^"]*"\s*)?(?:<\|--|\*--|o--|-->|--\*|--o|--\|>|<--|\.\.>|<\.\.|\.\.\|>|<\|\.\.|--|\.\.)\s*(?:"[^"]*"\s*)?([\w-]+)/);
    if (rel) names.add(rel[1]).add(rel[2]);
  }
  return names;
}

/** The transitions of a Mermaid stateDiagram: from, to, the label and the behaviour IDs the label cites. */
export function transitionsOf(body) {
  return body
    .split("\n")
    .map((line, i) => ({ line: i, m: line.match(/^\s*(\[\*\]|[\w-]+)\s*-->\s*(\[\*\]|[\w-]+)\s*(?::\s*(.*))?$/) }))
    .filter((x) => x.m)
    .map(({ line, m }) => ({ from: m[1], to: m[2], label: (m[3] ?? "").trim(), cites: [...(m[3] ?? "").matchAll(/\bB\d+\b/g)].map((x) => x[0]), offset: line }));
}
