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
- `sources` (ticket adapters) and custom model definitions are edited as raw JSON in `$EDITOR`.

## Develop

```bash
npm install
npm run dev      # run against ./crew.config.json
npm test
npm run verify   # typecheck + test + build
```
