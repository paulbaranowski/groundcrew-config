# crew-config

Interactive TUI to create and update [groundcrew](https://www.npmjs.com/package/@clipboard-health/groundcrew)'s `crew.config.json`.

## Install

```bash
npm install -g @clipboard-health/groundcrew-config
```

## Use

```bash
crew-config            # edit ./crew.config.json (or create one via the wizard)
crew-config --global   # edit ~/.config/groundcrew/crew.config.json
crew-config ./path/to/crew.config.json
```

- First run with no config launches a guided wizard, then drops into the editor.
- Reads any existing `crew.config.ts`/`.js`/`.json` to pre-fill, and always saves
  minimal `crew.config.json`. A shadowing `crew.config.ts`/`.js`/`.mjs` is moved to `*.bak`.
- Every save is validated by groundcrew's own loader, so "valid" means "crew accepts it".
- Custom ticket adapters and model definitions are edited as raw JSON in `$EDITOR`.

### Sections

- **Workspace** — project/worktree directories.
- **Repositories** — the repos groundcrew may work on (`owner/repo`, with an optional per-repo directory override).
- **Models** — enabled agent models (raw JSON).
- **Ticket Sources** — a hub for:
  - **Linear** — enable/disable. The API key is read from `GROUNDCREW_LINEAR_API_KEY` / `LINEAR_API_KEY` in your environment, _not_ this file; the screen shows whether it's set.
  - **PlanKeeper** — enable/disable. Install with `brew install paulbaranowski/tap/plan-keeper`; enabling adds the `plan-keeper crew …` shell source.
  - **Custom** — any other shell adapters, as raw JSON.
- **Orchestrator** — concurrency + polling + session-limit %.
- **Usage** — disable per-model usage tracking (groundcrew's opt-out from session-usage / codexbar gating).
- **Hooks / Git / Terminal / Sandbox / Prompts / Advanced** — the rest of `crew.config.json` (Terminal = `workspaceKind`).

## Develop

```bash
npm install
npm run dev      # run against ./crew.config.json
npm test
npm run verify   # typecheck + test + build
```
