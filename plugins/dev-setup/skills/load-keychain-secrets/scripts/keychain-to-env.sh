#!/usr/bin/env bash
# Copies secrets from the macOS Keychain into a dotenv file.
# Each NAME is looked up as a generic-password item whose service is NAME, and
# written as NAME=value. Values are never printed: only one status line per name.
#
# Usage: keychain-to-env.sh [--env-file PATH] [--overwrite] [--keychain PATH] NAME...
#
# Status lines:
#   found   NAME   written to the file
#   kept    NAME   already in the file, left as it was (pass --overwrite to replace)
#   missing NAME   no Keychain item with that service
#   invalid NAME   not a valid environment variable name
#   unquotable NAME  the value holds ', ` and ", which no dotenv quoting can carry

set -euo pipefail

env_file=".env"
overwrite=0
keychain=()
names=()

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) env_file="$2"; shift 2 ;;
    --overwrite) overwrite=1; shift ;;
    --keychain) keychain=("$2"); shift 2 ;;
    -*) echo "unknown option: $1" >&2; exit 1 ;;
    *) names+=("$1"); shift ;;
  esac
done

command -v security >/dev/null 2>&1 || { echo "security not found: the Keychain is macOS only" >&2; exit 1; }
[ ${#names[@]} -gt 0 ] || { echo "usage: keychain-to-env.sh [--env-file PATH] [--overwrite] [--keychain PATH] NAME..." >&2; exit 1; }

env_dir=$(dirname "$env_file")
[ -d "$env_dir" ] || { echo "folder not found: $env_dir" >&2; exit 1; }

# Make sure the file is ignored before any secret goes into it.
if repo_root=$(git -C "$env_dir" rev-parse --show-toplevel 2>/dev/null); then
  if git -C "$env_dir" ls-files --error-unmatch "$(basename "$env_file")" >/dev/null 2>&1; then
    echo "tracked $env_file: git already tracks it, so a secret written there would be committed" >&2
    exit 1
  fi
  if ! git -C "$env_dir" check-ignore -q "$(basename "$env_file")"; then
    entry="$(basename "$env_file")"
    gitignore="$repo_root/.gitignore"
    [ -s "$gitignore" ] && [ -n "$(tail -c1 "$gitignore")" ] && echo >> "$gitignore"
    echo "$entry" >> "$gitignore"
    echo "ignored $entry, added to $gitignore"
  fi
fi

if [ ! -e "$env_file" ]; then
  (umask 077 && : > "$env_file")
fi

# Quote only when the value needs it, with a quote character the value does not
# hold: dotenv and node --env-file have no escapes inside quotes. Fails when the
# value holds all three.
format_line() {
  local name=$1 value=$2 q
  if [[ "$value" =~ ^[A-Za-z0-9_./:@+=,-]*$ ]]; then
    printf '%s=%s' "$name" "$value"
    return
  fi
  for q in "'" '`' '"'; do
    if [[ "$value" != *"$q"* ]]; then
      printf '%s=%s%s%s' "$name" "$q" "$value" "$q"
      return
    fi
  done
  return 1
}

quoted='^password: "(.*)"$'
for name in "${names[@]}"; do
  if [[ ! "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "invalid $name"
    continue
  fi

  has_key=0
  grep -qE "^(export[[:space:]]+)?$name=" "$env_file" && has_key=1
  if [ $has_key -eq 1 ] && [ $overwrite -eq 0 ]; then
    echo "kept    $name"
    continue
  fi

  # -g prints `password: "value"`, `password: 0x<hex>  "..."` when the value
  # holds a newline or a non-ASCII byte (where -w would print bare hex), or
  # `password: ` when it is empty.
  if ! found=$(security find-generic-password -s "$name" -g ${keychain[@]+"${keychain[@]}"} 2>&1 >/dev/null); then
    echo "missing $name"
    continue
  fi
  found=$(printf '%s\n' "$found" | grep '^password: ' || true)
  if [[ "$found" =~ $quoted ]]; then
    value=${BASH_REMATCH[1]}
  elif [[ "$found" =~ ^password:\ 0x([0-9A-Fa-f]+) ]]; then
    value=$(printf '%s' "${BASH_REMATCH[1]}" | xxd -r -p)
  else
    value=""
  fi

  if ! line=$(format_line "$name" "$value"); then
    echo "unquotable $name"
    continue
  fi
  if [ $has_key -eq 1 ]; then
    # Replace the first assignment in place and drop any repeats, along with the
    # rest of a quoted value that runs over several lines. The line goes through
    # the environment so awk does not process its backslashes.
    tmp=$(mktemp "$env_file.XXXXXX")
    LINE="$line" awk -v key="$name" -v sq="'" '
      open != "" { if (index($0, open)) open = ""; next }
      $0 ~ "^(export[ \t]+)?" key "=" {
        if (!done) { print ENVIRON["LINE"]; done = 1 }
        rest = $0
        sub("^(export[ \t]+)?" key "=", "", rest)
        q = substr(rest, 1, 1)
        if ((q == sq || q == "\"" || q == "`") && !index(substr(rest, 2), q)) open = q
        next
      }
      { print }
    ' "$env_file" > "$tmp"
    chmod "$(stat -f %Lp "$env_file")" "$tmp"
    mv "$tmp" "$env_file"
  else
    [ -s "$env_file" ] && [ -n "$(tail -c1 "$env_file")" ] && echo >> "$env_file"
    printf '%s\n' "$line" >> "$env_file"
  fi
  echo "found   $name"
done
