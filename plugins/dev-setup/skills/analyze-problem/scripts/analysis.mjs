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

export const BEHAVIOUR = /^###\s+(B\d+)\b:?\s*(.*)$/;
export const CRITERION = /^\s*-\s+(B\d+\.\d+)\s+(.*)$/;
const DROPPED = /_\(dropped\)_/;
const EXISTS = /_\(exists\)_/;

/**
 * @returns {{ status: string | null, behaviours: Array<{ id: string, title: string, dropped: boolean,
 *   exists: boolean, line: number, criteria: Array<{ id: string, text: string, dropped: boolean, line: number }> }>,
 *   stray: Array<{ line: number, text: string, why: string }> }}
 */
export function parseAnalysis(text) {
  const behaviours = [];
  const stray = [];
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
      last = null;
      return;
    }
    if (/^#{1,6}\s/.test(line)) {
      if (/^#{1,6}\s+B\d+\b/.test(line)) stray.push({ line: n, text: line, why: 'a behaviour heading is "### B<n>: …"' });
      current = null;
      last = null;
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
  return { status, behaviours, stray };
}

/** The behaviours and criteria that coverage and tracing count: everything not marked _(dropped)_. */
export function live(analysis) {
  return analysis.behaviours
    .filter((b) => !b.dropped)
    .map((b) => ({ ...b, criteria: b.criteria.filter((c) => !c.dropped) }));
}
