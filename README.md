# Agent Skills

A personal Claude Code plugin marketplace, `adh-agent-utils`, holding reusable
utilities for setting up and configuring a development environment.

## Install

Add the marketplace, then install the plugin:

```
/plugin marketplace add adrianhdezm/agent-skills
/plugin install dev-setup@adh-agent-utils
```

## Layout

```
.claude-plugin/marketplace.json     marketplace definition, lists every plugin
plugins/<plugin>/
  .claude-plugin/plugin.json        plugin manifest (metadata, MCP servers)
  skills/<skill>/
    SKILL.md                        the skill itself; frontmatter name + description
    scripts/                        files the skill installs or runs
    references/                     detail loaded on demand
```

## Plugins

### `dev-setup`

Skills for configuring a machine with Claude Code — hooks, guardrails, and
tooling conventions.

| Skill | What it does |
| --- | --- |
| `create-node-project` | Scaffolds a single-package TypeScript project that Node 24 runs directly: pnpm, ESLint, Prettier, Vitest, and three passing checks |
| `setting-up-git-guardrails` | Installs a PreToolUse hook that blocks destructive git commands (force-push, `reset --hard`, `clean -f`, `branch -D`, whole-tree `checkout`/`restore`) |
| `setting-up-npm-block` | Installs a PreToolUse hook that redirects `npm` to `pnpm`, active only in repos with a `pnpm-lock.yaml` |
| `writing-a-skill` | Guidance for authoring new skills |

The plugin also registers the `chrome-devtools` MCP server.
