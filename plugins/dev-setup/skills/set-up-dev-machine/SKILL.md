---
name: set-up-dev-machine
description: Sets up a machine for working with Claude Code in three parts, each skipped when already done. It installs a PreToolUse hook that blocks destructive git commands (force-push, reset --hard, clean -f, branch -D, whole-tree checkout or restore), installs a PreToolUse hook that redirects npm to pnpm in pnpm repos, and gets the GitHub CLI installed, logged in with the workflow scope and set as git's credential helper. Use when the user runs /set-up-dev-machine, sets up a new machine, wants git guardrails or an npm block, or needs gh installed or logged in before the design and implementation phases.
---

# Set Up Dev Machine

Three parts, run in order: **git guardrails**, **npm block** and **GitHub CLI**. Run all three unless the user names
fewer (`/set-up-dev-machine gh`). Each part checks first and skips what is already in place, so running the skill
again is safe.

**Done means:** both hooks are in `~/.claude/settings.json` and block their test commands while letting the plain ones
through, and `gh auth status` passes with the `workflow` scope, with gh set as git's credential helper for github.com.

Keep going while the next step needs nothing from the user. Stop only for a login, which only the user can do.

## Workflow

```
- [ ] 1. Hook scripts copied
- [ ] 2. Hooks registered in settings
- [ ] 3. Hooks verified
- [ ] 4. gh installed
- [ ] 5. gh logged in, with the workflow scope
- [ ] 6. gh set as git's credential helper
```

1. **Copy the hook scripts** from this skill's `scripts/` to `~/.claude/hooks/`, creating the folder if it is missing,
   and make them executable:
   - `block-dangerous-git.sh`, the git guardrails
   - `block-npm.sh`, the npm block

   Overwrite an older copy: the script in this skill is the current one. Both need `jq`, and get out of the way
   without it, so if `command -v jq` finds nothing, install it (`brew install jq`).

2. **Register both hooks** in `~/.claude/settings.json`, as two entries in the one `"matcher": "Bash"` object under
   `PreToolUse`:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             { "type": "command", "command": "~/.claude/hooks/block-dangerous-git.sh" },
             { "type": "command", "command": "~/.claude/hooks/block-npm.sh" }
           ]
         }
       ]
     }
   }
   ```

   **Merge rules:**
   - No `settings.json`: create it with the structure above.
   - A `"matcher": "Bash"` entry exists: append each command its `hooks` array does not already have. Do not add a
     second Bash matcher.
   - No Bash matcher, but other matchers exist: add the Bash matcher object to the `PreToolUse` array.
   - Leave every other setting as it was.

3. **Verify the hooks.** A force-push exits 2 with a BLOCKED message naming the pattern on stderr:

   ```bash
   echo '{"tool_input":{"command":"git push --force origin main"}}' | ~/.claude/hooks/block-dangerous-git.sh
   ```

   A plain push exits 0 with no output:

   ```bash
   echo '{"tool_input":{"command":"git push origin main"}}' | ~/.claude/hooks/block-dangerous-git.sh
   ```

   `npm install` in a pnpm repo exits 2 with `BLOCKED: Use pnpm, not npm.` on stderr:

   ```bash
   d=$(mktemp -d) && git init -q "$d" && touch "$d/pnpm-lock.yaml" \
     && echo '{"tool_input":{"command":"npm install"}}' | (cd "$d" && ~/.claude/hooks/block-npm.sh); rm -rf "$d"
   ```

4. **Install gh** if `command -v gh` finds nothing: `brew install gh`. Without Homebrew, put the install under
   **Blocked on me** (<https://cli.github.com>) and stop.

5. **Log in.** Run `gh auth status`.
   - Not logged in: the login waits on a browser and a one-time code, so the user runs it in their own terminal. Put
     `gh auth login --hostname github.com --git-protocol https --web --clipboard --scopes workflow` under
     **Blocked on me**, stop, and go on from step 5 when they say it is done.
   - Logged in, but `workflow` is missing from its token scopes: the same, with
     `gh auth refresh --hostname github.com --scopes workflow`.

   The `workflow` scope is what lets a push add or change a file under `.github/workflows/`, which the S0 setup slice
   of an initiative does when it adds CI. The default scopes cover the rest: repos, pull requests and merges.

6. **Set gh as git's credential helper:** `gh auth setup-git`. Check it with
   `git config --global --get-all credential.https://github.com.helper`: an empty line, which clears any earlier helper,
   then one naming `gh auth git-credential`.

## What the git guardrails block

- `git push --force` / `--force-with-lease` / `-f`, in any argument position
- `git reset --hard`
- `git clean -f` / `-fd` / `-df` / `--force`
- `git branch -D` / `--delete --force`
- `git checkout .` / `git checkout -- .`
- `git restore .` / `git restore -- .`

A plain `git push` is allowed, and so are `git push -u`, `--tags`, `--dry-run` and `--delete`. Force-pushes and hard
resets are blocked through an alias or wrapper too (`g push --force`, `hub push -f`), since those are the least
recoverable.

Quoted strings are stripped before matching, so a command that only _mentions_ a dangerous one passes:
`grep -rn "git push" plugins/` and `git commit -m "document the reset --hard rule"`. So do the narrower forms
`git checkout -- src/foo.js` and `git branch -d merged`.

## What the npm block blocks

Any command that runs `npm` (at the start, or after `&&`, `||` or `;`) gets `BLOCKED: Use pnpm, not npm.` The hook
does nothing outside a git repo whose root has a `pnpm-lock.yaml`, and it leaves `npx` alone.

## End of the run

End with three headings: **Blocked on me** (a login or install only the user can do, as the command to run in their
terminal), **Changed** (the files copied, the settings entries added, the gh setup done) and **Found** (each part
skipped because it was already in place, and any check that did not give the expected result).

## Review Checklist

- [ ] Both scripts in `~/.claude/hooks/`, executable
- [ ] One Bash matcher holding both hook commands, no duplicates, other settings untouched
- [ ] The force-push and npm tests exit 2, the plain push exits 0
- [ ] `gh auth status` passes and its token scopes include `workflow`
- [ ] `gh auth git-credential` is git's credential helper for github.com
- [ ] Every login left to the user is under Blocked on me as a command to run in their terminal
