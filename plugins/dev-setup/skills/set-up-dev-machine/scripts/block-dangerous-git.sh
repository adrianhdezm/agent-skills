#!/usr/bin/env bash
# Git Guardrails — blocks dangerous git commands from being run by Claude.
# Installed as a PreToolUse hook for the Bash tool.

set -euo pipefail

# Fail open if jq is missing. A guardrail that can't parse its input should get
# out of the way rather than print an error on every single Bash call.
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

[ -z "$cmd" ] && exit 0

# Match against the command with quoted strings removed, so that merely
# *mentioning* a dangerous command doesn't trip the hook:
#   git commit -m "document the reset --hard rule"   -> allowed
#   grep -rn "git push" plugins/                     -> allowed
scan=$(echo "$cmd" | sed "s/'[^']*'//g; s/\"[^\"]*\"//g")

DANGEROUS_PATTERNS=(
  "push .*--force"    # --force and --force-with-lease, in any argument position
  "push -f"           # git push -f origin main
  "push .* -f( |$)"   # git push origin main -f
  "git clean -f"
  "git clean -df"
  "git clean --force"
  "git branch -D"
  "git branch --delete --force"
  # Whole-tree pathspecs only. The trailing boundary keeps narrow, safe
  # restores like `git checkout .gitignore` out of it; `..` stays blocked
  # because it discards the parent directory too.
  "git checkout \.\.?( |$)"
  "git checkout -- \.\.?( |$)"
  "git restore \.\.?( |$)"
  "git restore -- \.\.?( |$)"
  "reset --hard"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$scan" | grep -qE "$pattern"; then
    echo "BLOCKED: \"$cmd\" matches the dangerous pattern \"$pattern\". You do not have authority to run this command. Ask the user to run it manually." >&2
    exit 2
  fi
done

exit 0
