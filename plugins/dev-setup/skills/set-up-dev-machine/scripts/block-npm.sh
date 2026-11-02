#!/bin/bash
# Fail open if jq is missing, rather than erroring on every Bash call.
command -v jq >/dev/null 2>&1 || exit 0

# Only enforce in pnpm repos
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ] || [ ! -f "$REPO_ROOT/pnpm-lock.yaml" ]; then
  exit 0
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Check if the command starts with npm (as a command, not just mentioned in a substring).
# The trailing (\s|$) catches a bare `npm` while still leaving `npx` alone.
if echo "$COMMAND" | grep -qE '(^|&&|\|\||;)\s*npm(\s|$)'; then
  echo "BLOCKED: Use pnpm, not npm." >&2
  exit 2
fi

exit 0