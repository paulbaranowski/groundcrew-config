# Make `--global` the default scope

## Problem

`crew-config` defaults to **local** scope (`./crew.config.json`) and requires
`--global` to edit the user-level config at
`~/.config/groundcrew/crew.config.json`. We want the inverse: editing the
global config is the common case, so a bare `crew-config` should target the
global config, and editing a project-local config should require an explicit
opt-in.

## Behavior

| Invocation                               | Today                           | After                                                |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `crew-config`                            | local (`./crew.config.json`)    | **global** (`~/.config/groundcrew/crew.config.json`) |
| `crew-config --local`                    | n/a (unknown, silently ignored) | local (`./crew.config.json`)                         |
| `crew-config --global`                   | global                          | **error: unknown flag**                              |
| `crew-config ./path/to/crew.config.json` | explicit path                   | explicit path (unchanged)                            |

Rules:

- **Default scope is global.** With no scope flag and no explicit path, resolve
  to the XDG global config directory.
- **`--local` selects local scope** (the current working directory).
- **An explicit path overrides scope**, exactly as today. `--local ./foo` and
  `./foo` both resolve to the path; the scope flag is irrelevant once a path is
  given.
- **`--global` is removed.** It is no longer a recognized flag.

## The unknown-flag guard

Today `locate()` derives the path with
`argv.find((a) => !a.startsWith("-"))` and the scope with
`argv.includes("--global")`. Any unrecognized `-`-prefixed argument is silently
ignored.

That silent-ignore was harmless when local was the default, but it is a footgun
once global is the default:

- A typo'd `--local` (e.g. `--locl`, `--loca`) would silently fall through to
  **global** and edit the wrong file with no indication.
- A removed `--global` would "just work" by coincidence (silently mapping to the
  global default), which is exactly the confusing non-error behavior we don't
  want.

So we add a guard: before resolving scope or path, reject any argument that
starts with `-` and is not `--local`. The error names the offending flag, e.g.:

```
unknown flag: --global
```

This makes the removal of `--global` visible (it errors and tells you the flag
is gone) and closes the typo-writes-to-wrong-scope hole.

The guard rejects `-`-prefixed args only. Non-flag arguments continue to be
treated as an explicit path.

## Components

### `src/io/locate.ts`

- Replace the scope derivation
  `const scope = argv.includes("--global") ? "global" : "local";`
  with
  `const scope = argv.includes("--local") ? "local" : "global";`.
- Add an unknown-flag guard at the top of `locate()`: scan `argv` for any entry
  starting with `-` that is not `--local`, and throw an `Error` naming the first
  such flag.
- The explicit-path discovery logic (existing-config discovery, `.ts`/`.mjs`/
  `.js`/`.json` precedence, `.json` fallback) is unchanged. With global as the
  default, a bare invocation now discovers/creates in the XDG dir.

### `src/io/locate.test.ts`

- `falls back to crew.config.json when no config exists in cwd`: bare `locate([], cwd)`
  now resolves **global** scope and a path under the XDG dir. Update the
  expectation, and use `["--local"]` where the intent is to assert the local
  fallback.
- `discovers an existing crew.config.ts in the directory` and
  `prefers .ts over .json …`: these assert cwd discovery, so they must pass
  `["--local"]` (bare argv now points at the XDG dir, not cwd).
- Rename/repurpose `--global targets the XDG directory` to assert that the
  **default** (bare argv) targets the XDG directory, and add a test that
  `--local` targets cwd.
- `an explicit path overrides scope`: unchanged in intent; keep.
- Add a test: an unknown flag (e.g. `["--global"]`) causes `locate()` to throw,
  and the message names the flag.

### `README.md`

Update the Use block:

```bash
crew-config            # edit the global ~/.config/groundcrew/crew.config.json
crew-config --local    # edit ./crew.config.json in the current project
crew-config ./path/to/crew.config.json
```

Adjust the surrounding prose so the no-config wizard line and the
existing-config discovery line read correctly against a global default.

## Error handling

- Unknown `-`-prefixed flag → `locate()` throws `Error("unknown flag: <flag>")`.
  `cli.tsx` calls `locate()` at module top level; an unhandled throw exits the
  process non-zero with the message, which is the desired CLI behavior (no TUI
  is rendered for a bad invocation). No try/catch is added.

## Testing

- Unit tests in `src/io/locate.test.ts` cover: default → global, `--local` →
  cwd, `--local` discovery precedence, explicit path override, and unknown-flag
  rejection.
- `npm run verify` (typecheck + test + build) must pass.

## Out of scope

- No "smart" local-if-present-else-global detection. The default is
  unconditionally global.
- No backward-compatibility shim for `--global`.
- No general argument parser / help-flag handling beyond the unknown-flag guard.
