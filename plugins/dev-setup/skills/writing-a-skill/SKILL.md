---
name: writing-a-skill
description: Creates new agent skills with proper structure, progressive disclosure, and bundled resources. Use when the user wants to create, write, or build a new skill.
---

# Writing Skills

## Process

1. **Gather requirements** — ask about:
   - What task/domain does the skill cover?
   - What specific use cases should it handle?
   - Does it need executable scripts or just instructions?

2. **Draft the skill** — create SKILL.md plus any reference files or scripts needed.

3. **Review with user** — confirm coverage, then iterate based on real usage.

## Skill Structure

```
skill-name/
├── SKILL.md           # Main instructions (required, keep under 500 lines)
├── references/        # Detailed docs (if needed)
│   └── topic.md
└── scripts/           # Utility scripts (if needed)
```

## SKILL.md Template

```md
---
name: skill-name # verb-object form, lowercase, hyphens, max 64 chars
description: One sentence what it does. Use when [specific triggers/keywords].
---

# Skill Name

[Minimal quick-start example inline]

**Done means:** [the finish line, checkable: files written, checks passing, the user's explicit yes]

## Workflows

[Step-by-step process. Add a checkbox checklist for complex multi-step tasks.]

## End of the run

End with three headings: **Blocked on me**, **Changed** and **Found**.

## References

[Link out to separate files only if content would push SKILL.md past 500 lines. Example: **Form filling**: See [references/forms.md](references/forms.md)]

## Review Checklist

- [ ] [key step 1]
- [ ] [key step 2]
```

Omit any section that doesn't apply — don't leave empty placeholders.

## Naming

Use verb-object form, the command the user would type: `verify-build`, `debug-failure`, `confirm-my-goal`. Lowercase letters, numbers, and hyphens only, max 64 chars. The H1 title matches the name (`# Verify Build`).

A skill that scaffolds a new project is named `create-<thing>`, after the `pnpm create` / `npm init` convention users already search for: `create-node-project`, `create-cloudflare-worker`, `create-fullstack-app`.

Older skills keep their gerund names (`setting-up-npm-block`, `writing-a-skill`). Do not use that form for new ones.

## Description

Third person. First sentence: what it does. Second sentence: `Use when [specific triggers/keywords]`. Max 1024 chars.

```
# Good
Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when user mentions PDFs, forms, or document extraction.

# Bad
Helps with documents.
```

## Writing for the model

- **Say what done looks like**, in one line near the top. The model works toward the finish line it is given.
- **Say when to keep going and when to stop**, for any skill that runs more than a few steps: keep going while the next step needs nothing from the user; stop only for input only the user can give, or before anything destructive or outside the repo (deleting data, force-pushing, changing infrastructure).
- **Keep the task list in a file** when a run can outlive its context (several slices, several sessions). The user reads the file instead of the scrollback.
- **End with Blocked on me, Changed and Found**, in that order, so the user sees first what needs them.
- **No "think carefully" or "think step by step" lines.** The model already thinks before it answers; depth is set by effort, not by the prompt.
- **Do not ask it to write out its reasoning.** Ask for the reason in a sentence or two.
- **Research steps mark what they could not confirm**, and say where they looked.
- **Review steps list only what blocks**, each with `file:line`, why it is wrong and how to show that it fails.

## Progressive Disclosure

SKILL.md is a table of contents — load detail only when needed.

**Add scripts** when the operation is deterministic (validation, formatting) or the same code would be generated repeatedly. Scripts save tokens and improve reliability vs generated code.

**Split into reference files** when:

- SKILL.md body exceeds 500 lines
- Content has distinct domains (finance vs sales schemas)
- Some references are rarely needed

SKILL.md should link directly to reference files — those files must not link onward to further files.

**Three patterns for linking references:**

High-level guide — put the quick start inline, link detailed content under `## References`:

```md
## References

**Form filling**: See [references/forms.md](references/forms.md) **API reference**: See [references/api.md](references/api.md)
```

Domain-specific files — one file per domain so unrelated context is never loaded:

```
references/
├── finance.md   # revenue, billing
├── sales.md     # pipeline, accounts
└── product.md   # API usage, features
```

Conditional details — show the basic path inline, link the edge case:

```md
For simple edits, modify the XML directly. **For tracked changes**: See [references/redlining.md](references/redlining.md)
```

For reference files longer than 100 lines, add a table of contents at the top so Claude can navigate without reading the whole file.

## Review Checklist

- [ ] Name uses verb-object form, or `create-<thing>` for a project scaffolder
- [ ] Description includes "Use when..." with specific triggers
- [ ] A **Done means** line, and an End of the run with Blocked on me / Changed / Found
- [ ] A skill that runs long says when to keep going and when to stop
- [ ] No "think carefully" or "step by step" lines
- [ ] SKILL.md body under 500 lines
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Concrete examples included
- [ ] References one level deep only
