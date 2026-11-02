---
name: load-keychain-secrets
description: Copies secrets from the macOS Keychain into a project's or a sandbox's .env file without the values ever passing through the conversation. Takes a list of variable names (or the keys of .env.example), looks each one up as a generic-password item whose service is the name, writes the ones it finds, keeps keys the file already has unless told to overwrite, makes sure the file is git-ignored first, and reports each name as found, kept or missing. Use when the user runs /load-keychain-secrets, asks to fill a .env from the Keychain, or a project or experiment sandbox needs API keys or tokens the user keeps in the Keychain.
---

# Load Keychain Secrets

```bash
scripts/keychain-to-env.sh --env-file .env OPENAI_API_KEY STRIPE_SECRET_KEY
# found   OPENAI_API_KEY
# missing STRIPE_SECRET_KEY
```

**Done means:** every name was reported as found, kept or missing, each found one is in the target file, the file is
git-ignored, and no secret value appeared in the conversation.

## Never see a value

The script writes each value straight into the file and prints only a status per name. Keep it that way: do not
`cat`, `grep`, `source` or print the target file, do not run `security find-generic-password` yourself, and do not
echo a variable that holds a secret. To check what is in the file, read the script's status lines. Any check of your
own reads key names only, such as `cut -d= -f1 .env`.

## Workflow

1. **The names.** Use the names the user passed. If they passed none, use the keys of `.env.example` next to the
   target file: the part before `=` on each line that is not a comment. If neither exists, ask for the list.

2. **The target.** Default is `.env` at the root of the current repo (`git rev-parse --show-toplevel`). When the user
   names a sandbox, it is `.env` at the sandbox's root, such as `${CLAUDE_PLUGIN_DATA}/sandbox/<name>/.env`. When they
   name another file (`.env.local`, `.dev.vars`), pass it as is. The file's folder must exist.

3. **Run the script** from this skill's `scripts/` folder:

   ```bash
   scripts/keychain-to-env.sh --env-file <target> [--overwrite] NAME...
   ```

   Pass `--overwrite` only when the user asked to replace values the file already has. macOS may show a dialog
   asking to let `security` read an item. The user clicks **Allow**, or **Always Allow** to skip it next time. A
   denied dialog shows up as `missing`.

4. **Read the status lines:**

   | Status       | Meaning                                                                 | What to do                        |
   | ------------ | ----------------------------------------------------------------------- | --------------------------------- |
   | `found`      | Written to the file                                                     | Nothing                           |
   | `kept`       | Already in the file, left as it was                                     | Report it. `--overwrite` replaces |
   | `missing`    | No Keychain item with that service, or access was denied                | Blocked on me, below              |
   | `invalid`    | Not a valid variable name: letters, digits and `_`, no leading digit    | Ask for the right name            |
   | `unquotable` | The value holds `'`, `` ` `` and `"`, which no `.env` quoting can carry | Tell the user; nothing written    |
   | `ignored`    | The file was not git-ignored, so its name was added to `.gitignore`     | Report it under Changed           |

   The script exits 1, writing nothing, when git already tracks the target file: the secrets would be committed. Stop
   and tell the user. Untracking it (`git rm --cached <file>`) is their call.

5. **Missing secrets.** Put each one under **Blocked on me** with the command to store it, which the user runs in
   their own terminal so the value never reaches the conversation:

   ```bash
   security add-generic-password -s NAME -a "$USER" -w
   ```

   With `-w` last and no value after it, `security` prompts for the value. When the user says they are stored, run
   the script again for those names only.

## How the Keychain item is matched

By service name only: `security find-generic-password -s NAME`, the first match in the keychain search list, whatever
its account. An item stored under another service name is not found. Store a copy under the variable's name.

Values are written unquoted when they hold only letters, digits and `_ . / : @ + = , -`. Otherwise they are wrapped in
the first of `'`, `` ` `` or `"` that the value does not contain, which `node --env-file` and dotenv both read
literally, newlines included.

## End of the run

End with three headings: **Blocked on me** (each missing name with its `security add-generic-password` command, a
tracked target file, an `unquotable` value), **Changed** (the target file and the names written to it, and
`.gitignore` if the script added to it) and **Found** (names kept because they were already there, and names that
were invalid).

## Review Checklist

- [ ] Every name has a status line from the script
- [ ] The target is git-ignored, or the run stopped because git tracks it
- [ ] `--overwrite` only when the user asked for it
- [ ] No secret value printed, read back or echoed
- [ ] Each missing name is under Blocked on me with its store command
