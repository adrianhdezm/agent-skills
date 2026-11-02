// Reads docs/<slug>/02-analysis.md into its status line, behaviours (B1…) and acceptance criteria (B1.1…).
//
// The one definition of the analysis format that scripts read: check-analysis.mjs here, build-plan.mjs in
// design-solution and trace.mjs in verify-build all import it, so the three cannot drift apart.
//
//   ### B3: A teammate can vote for one place and change their vote.
//   - B3.1 Given an open poll, when a teammate votes for a place, then …
//     a continuation line is indented
//
// A heading or a criterion marked _(dropped)_ keeps its number and is skipped by coverage checks.
//
// Releases cut the behaviours into the order they ship; the design and verification work one release at a time:
//
//   ## Releases
//
//   - **R1: First potluck**: B1, B2, B3 · a host can run one potluck end to end

export const BEHAVIOUR = /^###\s+(B\d+)\b:?\s*(.*)$/;
export const CRITERION = /^\s*-\s+(B\d+\.\d+)\s+(.*)$/;
export const RELEASE = /^\s*-\s+\*\*(R\d+)\b:?\s*(.*?)\*\*:?\s*(.*)$/;
const DROPPED = /_\(dropped\)_/;
const EXISTS = /_\(exists\)_/;

/**
 * @returns {{ status: string | null, behaviours: Array<{ id: string, title: string, dropped: boolean,
 *   exists: boolean, line: number, criteria: Array<{ id: string, text: string, dropped: boolean, line: number }> }>,
 *   releases: Array<{ id: string, name: string, covers: string[], goal: string, line: number }> | null,
 *   stray: Array<{ line: number, text: string, why: string }> }}
 */
export function parseAnalysis(text) {
  const behaviours = [];
  const stray = [];
  let releases = null;
  let inReleases = false;
  let status = null;
  let current = null;
  let last = null;
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    const n = i + 1;
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      last = null;
      return;
    }
    if (fenced) return;
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
      last = null;
      return;
    }
    if (/^#{1,6}\s/.test(line)) {
      if (/^#{1,6}\s+B\d+\b/.test(line)) stray.push({ line: n, text: line, why: 'a behaviour heading is "### B<n>: …"' });
      if (/^##\s/.test(line)) inReleases = /^##\s+Releases\b/.test(line);
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
  return { status, behaviours, releases, stray };
}

/** Which release each behaviour ships in: B -> R. Empty when the analysis has no releases. */
export function releaseOf(analysis) {
  return new Map((analysis.releases ?? []).flatMap((r) => r.covers.map((b) => [b, r.id])));
}

/** The behaviours and criteria that coverage and tracing count: everything not marked _(dropped)_. */
export function live(analysis) {
  return analysis.behaviours
    .filter((b) => !b.dropped)
    .map((b) => ({ ...b, criteria: b.criteria.filter((c) => !c.dropped) }));
}
