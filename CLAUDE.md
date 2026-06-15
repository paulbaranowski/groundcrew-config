# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`crew-config` (`@clipboard-health/groundcrew-config`) is an interactive Ink (React-for-the-terminal) TUI that creates and edits [groundcrew](https://www.npmjs.com/package/@clipboard-health/groundcrew)'s `crew.config.json`. It is a thin, opinionated editor over groundcrew's own config schema — it does not own that schema.

The config file this tool produces is consumed by **groundcrew** ([npm](https://www.npmjs.com/package/@clipboard-health/groundcrew)), whose source lives locally at **`~/dev/groundcrew`** on disk. When you need to confirm the actual schema, what `loadConfig` accepts, defaults, or how a config field behaves, **read the groundcrew source in `~/dev/groundcrew`** rather than guessing — this TUI's notion of "valid" is literally whatever that code accepts (see validation below).

## Commands

```bash
npm install
npm run dev            # run the TUI against ./crew.config.json (tsx, no build)
npm test               # vitest run (all *.test.{ts,tsx} under src/)
npm run test:watch     # vitest in watch mode
npm run typecheck      # tsc --noEmit
npm run build          # tsup → dist/cli.js
npm run verify         # typecheck + test + build (the pre-publish gate)
npm run bump           # npm version patch --no-git-tag-version (bump package.json only)
```

**Always bump the version for every PR.** Run `npm run bump` (a patch bump) as part of preparing any PR so `package.json`'s `version` changes. This is required, not optional: `.github/workflows/release.yml` cuts a release on push to `main` _only_ when the version gains a new value — it tags `v<version>`, publishes a GitHub release, and rewrites the Homebrew formula. A PR that leaves the version untouched ships nothing. `npm run bump` edits `package.json` only (no git tag/commit — CI owns the tag); use `npm version minor` / `npm version major --no-git-tag-version` instead when the change warrants it.

Run a single test file or test by name:

```bash
npx vitest run src/io/validate.test.ts
npx vitest run -t "maps section"
```

`node scripts/verify-teardown.mjs` (after `npm run build`) is a **manual** check — not part of `npm test` — that drives the built CLI under a pseudo-terminal to confirm it restores the terminal on SIGINT/SIGTERM/SIGHUP. Run it after touching `src/hooks/useFullscreen.ts` or any teardown path.

Requires Node >= 24. The project is ESM-only (`"type": "module"`), uses `NodeNext` resolution with `allowImportingTsExtensions`, so **intra-repo imports carry the `.ts`/`.tsx` extension** (e.g. `import { App } from "./app.tsx"`).

## Core architectural ideas

**The draft _is_ groundcrew's `Config`.** `ConfigDraft` (`src/domain/types.ts`) is a type alias for `Config` from `@clipboard-health/groundcrew`. The app edits this object in place; it never defines its own schema. groundcrew is a runtime dependency that is **not bundled** (`external` in `tsup.config.ts`) — it is resolved from the user's install.

**Validity is defined by groundcrew, not by us.** `src/io/validate.ts` writes the pruned draft to a temp sidecar and spawns a child Node process that imports groundcrew's real `loadConfig`. "Valid" therefore means "crew accepts it." Validation runs **debounced (150ms) on every draft change** from `app.tsx`. When the config already exists on disk, validation runs in the config's real directory so config-relative paths (e.g. `prompts.promptFile`) resolve exactly as groundcrew will resolve them.

**Layered by purity** — keep new code in the matching layer:

- `src/domain/` — pure, React-free logic: typed read/update helpers over the draft (`sources.ts`, `agents.ts`, `repoEntries.ts`, `usage.ts`), the section registry (`sections.ts`), pruning (`prune.ts`), path access (`draftPath.ts`), env/XDG (`env.ts`, `xdg.ts`).
- `src/io/` — all filesystem/process effects: `load.ts` (cosmiconfig multi-format read), `save.ts` (always writes minimal `crew.config.json`), `validate.ts`, `locate.ts` (resolves scope + path from argv).
- `src/components/` — reusable Ink widgets (`TextField`, `SelectField`, `ListField`, `ScrollableList`, `Footer`).
- `src/screens/` — one editor per section; bespoke screens for complex sections, generic `SectionForm` (driven by `simpleSectionSpec`) for the simple ones.
- `src/hooks/useFullscreen.ts` — alt-screen lifecycle + terminal-size tracking.

**State and navigation live in `src/app.tsx`.** A single `draft` in `useState` is the source of truth, threaded down to every screen as `draft` / `onChange` / `onBack` — there is no state library and no router. Navigation is a 2-variant union `Route = {name:"home"} | {name:"section", id}`. Screens never save or validate; they only call `onChange(nextDraft)`. The `Screen` wrapper is hoisted to module scope on purpose (defining it inside `App` would remount the route subtree and drop input focus on each render).

## Conventions that bite if missed

- **Saving prunes.** `save.ts` writes `pruneEmpty(draft)` so the output is minimal `crew.config.json`. `prune.ts` has deliberate exceptions: it always keeps top-level `workspace` and `workspace.knownRepositories` (required), and re-attaches `agents.definitions[name] = {}` empty objects (an empty definition is the _enable marker_ for a built-in agent — pruning it would dangle `agents.default`). If you add config where "empty but present" is meaningful, prune.ts must learn about it.
- **Shadowing files are moved aside, never clobbered.** groundcrew's loader prefers `crew.config.ts`/`.mjs`/`.js` over `.json`. On save, any such file is renamed to `*.bak` (first free suffix) so the `.json` we wrote is the one that loads.
- **Scope: global is the default.** No flag → edits `~/.config/groundcrew/crew.config.json` (XDG). `--local` → `./crew.config.json`. A bare path arg → that exact file. There is no `--global` flag, and `locate.ts` rejects unknown flags loudly (a silent typo would write to the wrong config).
- **Section badges come from a prefix table.** `validate.ts` `mapSection()` routes a groundcrew error to a `SectionId` by matching the **key path** (not the whole message) against `SECTION_PREFIXES`, which is ordered **most-specific-first** (e.g. `workspaceKind` before `workspace`, `orchestrator.sessionLimitPercentage` → the Usage badge before bare `orchestrator`). Adding a section or moving a field between screens means updating this table.
- **Task sources are matched structurally, not by a flag.** `domain/sources.ts` derives enabled/kind/name from the `sources[]` array shape (`kind`, `name`, `enabled !== false`). Linear is _not_ implicit (groundcrew ≥ 4.24); PlanKeeper is a specific `kind:"shell"` preset named `plankeeper`. The TUI owns linear/todo-txt/plan-keeper/shell entries and **preserves unknown-kind sources untouched** on save.
- **Vocabulary mirrors groundcrew: "task", never "ticket".** groundcrew's domain noun is the _task_ (`TaskSource`, `docs/task-sources.md`). Keep this TUI's identifiers and copy aligned — the section id is `taskSources`, not `ticketSources`. The one deliberate exception: `io/validate.test.ts` keeps a `{{ticket}}` fixture because it asserts groundcrew _rejects_ that unknown prompt placeholder (the allowed one is `{{task}}`) — do not "fix" it in a ticket→task sweep.
- **Shell sources carry an `env` map.** A `kind:"shell"` source may set `env: Record<string,string>`; groundcrew merges it onto `process.env` for every command it runs (see `~/dev/groundcrew` shell adapter). The builder edits it via `ShellEnvEditor` (a `ListField` of key/value entries, one level under `ShellSourceSubForm`). `readShellFields`/`applyShellFields` round-trip it through `ShellFields.env` (an ordered `EnvEntry[]`, collapsed back to a `Record` on apply: blank keys dropped, later key wins, empty → no `env` key). Other source keys the TUI doesn't model (e.g. `timeouts`) still pass through untouched via the base-merge.
- **Buffered sub-editors guard a dirty esc.** A sub-editor (RepoSubForm, ShellSourceSubForm, AgentSubForm, the env-var editor) buffers edits locally and commits only on Enter. Esc no longer discards silently: `useEditGuard` (`hooks/useEditGuard.ts`) tracks a dirty flag (wrap field setters with `guard.track`, or call `guard.markDirty`), and esc on a _dirty_ buffer pops `SaveGuard` (`a` apply · `d` discard · esc keep editing) instead of cancelling. An untouched editor still exits on the first esc. The verb is deliberately "Apply" not "Save": `SaveGuard` only commits the buffered edit into the in-memory draft — top-level Save (the QuitGuard / explicit save flow) is the only thing that writes `crew.config.json`, and the wording keeps that distinction visible. New buffered sub-editors should follow the same wiring: gate the editor's `useInput` on `!guard.guarding`, route esc through `guard.requestCancel(onCancel)`, and early-return `<SaveGuard>` while `guarding`.
- **Fullscreen teardown is wired before entry.** `installFullscreen` (called from `cli.tsx`) registers `exit`/signal/error restore handlers _before_ entering the alt screen, so a crash during startup can never strand the terminal. The controller's `exit()` is idempotent. Off-TTY (pipes/CI) everything no-ops and no escape sequences are emitted.

## Testing

Vitest with `ink-testing-library`. Tests are colocated (`foo.ts` ↔ `foo.test.ts`). Screen/app tests render the component and assert on `lastFrame()`, driving input via `stdin.write(...)` (`"\r"` = enter, `"\x1b"`-prefixed for arrows/esc). Domain and io modules are tested as plain functions. `App` takes `initialDraft` and `target` as props specifically so tests can render it without touching disk or a TTY.

**Input is async; await a re-render between dependent keystrokes.** `useInput` handlers close over render-time state, and React batches updates, so a _burst_ of `stdin.write`s in one tick all see the stale closure. Two consequences for tests: (1) when a keystroke's effect depends on a prior one (e.g. arrow-to-move-focus then type), `await vi.waitFor(() => expect(lastFrame())...)` between them to force the re-render; (2) a `TextField` mounted _by_ an interaction (e.g. opening a sub-editor) needs an effect tick to subscribe to stdin — type immediately and the first keystroke is dropped, so settle briefly first. Production screens that branch on a moving cursor inside `useInput` dodge the same staleness by mirroring it in a `useRef` (see `ListField`, `ShellSourceSubForm`); reach for the ref when correctness — not just a test — depends on reading the latest index mid-burst.
