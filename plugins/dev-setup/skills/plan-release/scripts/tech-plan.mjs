// Reads docs/<slug>/03-tech-plan.md into its status, base commit, slices and Mermaid diagrams.
//
// The one definition of the tech plan format that scripts read: build-review.mjs here, trace.mjs in verify-release
// and progress.mjs in implement-release import it.
//
//   Status: Approved 2026-11-02
//   Stack: … · Conventions: `coding-conventions.md` · Constraints: `CONSTRAINTS.md` · Base: `3f2a9c1`
//
//   ## Modules
//
//   ```mermaid
//   classDiagram
//     ClaimsRoute ..> SlotsDao : claim()
//   ```
//
//   ## Slices
//
//   ### S0: The project builds, lints and tests from one command (setup)
//
//   ### S1: A host can create a potluck and share its link (B1, B2)
//
//   - Tests: B1.1 unit · B1.2 integration · B2.1 end to end
//   - Depends on: none
//
//   ```mermaid
//   sequenceDiagram
//     Host->>PotlucksRoute: POST /potlucks
//   ```

const SLICE = /^###\s+(S\d+)\b:?\s*(.*)$/;

/**
 * @returns {{ status: string | null, base: string | null, slices: Array<{ id: string, title: string,
 *   covers: string[], tests: Array<{ id: string, tier: string }>, dependsOn: string[] | null,
 *   diagrams: string[], stray: string[], line: number }>,
 *   diagrams: Array<{ kind: string, section: string, slice: string | null, line: number }> }}
 */
export function parseTechPlan(text) {
  let status = null;
  let base = null;
  const slices = [];
  const diagrams = [];
  let section = "";
  let inSlices = false;
  let current = null;
  let fenced = false;
  let diagram = null;
  text.split("\n").forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      if (fenced && /^\s*```\s*mermaid\b/.test(line)) diagram = { kind: "", section, slice: current?.id ?? null, line: i + 1 };
      else if (!fenced && diagram) {
        diagrams.push(diagram);
        current?.diagrams.push(diagram.kind);
        diagram = null;
      }
      return;
    }
    if (fenced) {
      if (diagram && !diagram.kind && line.trim() && !/^\s*%%/.test(line)) diagram.kind = line.trim().split(/\s+/)[0];
      return;
    }
    const s = line.match(/^Status:\s*(.*)$/);
    if (s && status === null) status = s[1].trim();
    const b = line.match(/\bBase:\s*`?([0-9a-f]{7,40})\b`?/i);
    if (b && base === null && !inSlices) base = b[1];
    if (/^##\s/.test(line)) {
      section = line.replace(/^##\s+/, "").trim();
      inSlices = /^Slices\b/.test(section);
      current = null;
      return;
    }
    if (!inSlices) return;
    const h = line.match(SLICE);
    if (h) {
      const paren = h[2].match(/\(([^()]*)\)\s*$/);
      current = {
        id: h[1],
        title: h[2].replace(/\s*\([^()]*\)\s*$/, "").trim(),
        covers: paren ? [...paren[1].matchAll(/\bB\d+\b/g)].map((m) => m[0]) : [],
        tests: [],
        dependsOn: null,
        diagrams: [],
        stray: [],
        line: i + 1
      };
      slices.push(current);
      return;
    }
    if (!current) return;
    const t = line.match(/^\s*-\s+Tests:\s*(.*)$/i);
    if (t) {
      for (const part of t[1].split(/[·,;]/).map((p) => p.trim()).filter(Boolean)) {
        const m = part.match(/^(B\d+\.\d+)\b\s*(.*)$/);
        if (m) current.tests.push({ id: m[1], tier: m[2].trim().toLowerCase() });
        else current.stray.push(part);
      }
      return;
    }
    const d = line.match(/^\s*-\s+Depends on:\s*(.*)$/i);
    if (d) current.dependsOn = [...d[1].matchAll(/\bS\d+\b/g)].map((m) => m[0]);
  });
  return { status, base, slices, diagrams };
}
