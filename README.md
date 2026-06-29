# crew-config

Interactive TUI to create and update [groundcrew](https://www.npmjs.com/package/@clipboard-health/groundcrew)'s `crew.config.json`.

## Install

```bash
brew install paulbaranowski/tap/crew-config
```

## Use

```bash
crew-config            # edit the global ~/.config/groundcrew/crew.config.json
crew-config --local    # edit ./crew.config.json in the current project
crew-config ./path/to/crew.config.json
```

- With no config, opens the editor on an empty draft — fill in Workspace and add at least one Task Source (groundcrew needs one to run; the footer warns when none is set).
- Reads any existing `crew.config.ts`/`.js`/`.json` to pre-fill, and always saves
  minimal `crew.config.json`. A shadowing `crew.config.ts`/`.js`/`.mjs` is moved to `*.bak`.
- Every save is validated by groundcrew's own loader, so "valid" means "crew accepts it".
- Unmanaged shell task sources have no screen, and non-built-in agent definitions are listed read-only; author both by hand in `crew.config.json`. The TUI preserves them untouched on save.

### Sections

- **Workspace** — project/worktree directories.
- **Repositories** — the repos groundcrew may work on (`owner/repo`, with an optional per-repo directory override). The repo editor also covers `workdir` (a project subdirectory within the worktree) and `provision` (scripted `create`/`remove` worktree templates — both `create` and `remove` are required, and `provision` is mutually exclusive with the directory override).
- **Agents** — enable the built-in agents (claude, codex) and edit their fields; any non-built-in agent definitions are listed read-only (author them in `crew.config.json`).
- **Task Sources** — a hub (groundcrew needs at least one enabled source to run):
  - **Linear** — enable/disable (groundcrew 4.24+ no longer enables Linear implicitly). The API key is read from `GROUNDCREW_LINEAR_API_KEY` / `LINEAR_API_KEY` in your environment, _not_ this file; the screen shows whether it's set.
  - **todo-txt** — enable/disable a zero-credentials local-file source, with editable `todoPath` / `tasksDir`.
  - **PlanKeeper** — enable/disable. Install with `brew install paulbaranowski/tap/plan-keeper`; enabling adds the `plan-keeper crew …` shell source.
  - **Shell sources** — managed shell adapters. Any other (unmanaged) shell sources are authored by hand in `crew.config.json`; the TUI preserves them on save but no longer surfaces a screen for them.
- **Orchestrator** — concurrency + polling (`maximumInProgress`, `pollIntervalMilliseconds`).
- **Usage Limits** — toggle per-agent usage tracking and set the session-usage ceiling (`sessionLimitPercentage`) above which groundcrew stops launching. Tracking requires the [codexbar](https://codexbar.app/) menu-bar app on Mac (`brew install --cask steipete/tap/codexbar`); groundcrew reads usage via its bundled `codexbar` CLI. (The limit is still stored as `orchestrator.sessionLimitPercentage` in the file.)
- **Prompts** — the initial agent prompt, set inline (`initial`) or loaded from a file (`promptFile`); the two are mutually exclusive. The screen also has a **Browse packaged prompts →** entry: pick one from the bundled list (e.g. _Autonomous task → PR_) and `crew-config` writes the prompt to `<config-dir>/prompts/<slug>.md` and points `promptFile` at it. Installed prompts are plain Markdown — edit them in place.
- **Hooks / Git / Terminal / Sandbox / Advanced** — the rest of `crew.config.json` (Terminal = `workspaceKind`, which now includes `zellij`).

## Full-screen

`crew-config` runs as a full-screen TUI (like `vim`/`lazygit`): it takes over the
alternate screen on launch and restores your previous terminal contents and
scrollback on exit — quitting leaves no leftover render. The status/keybinding
footer is pinned to the bottom row, the layout stays stable as you move between
screens, and long lists (repositories, shell sources, the Home menu) scroll
within the viewport with `↑ N more` / `↓ N more` markers instead of overflowing.

The terminal is restored on every exit path — `q`, Ctrl-C, `kill`, or an
unexpected error — so you never land in a stranded alt screen. When stdout is not
a TTY (piped output or CI) the full-screen behavior is disabled and no escape
sequences are emitted.

## Develop

```bash
npm install
npm run dev      # run against ./crew.config.json
npm test
npm run verify   # typecheck + test + build
```

`node scripts/verify-teardown.mjs` (after `npm run build`) checks that the built
CLI restores the terminal on SIGINT/SIGTERM/SIGHUP by driving it under a
pseudo-terminal. It's a manual check — not part of `npm test` — for use after
touching the full-screen/teardown code in `src/hooks/useFullscreen.ts`.
