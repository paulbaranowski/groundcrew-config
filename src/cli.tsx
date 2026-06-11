import { render } from "ink";
import { App } from "./app.tsx";
import { createFullscreen, installFullscreen } from "./hooks/useFullscreen.ts";
import { loadDraft } from "./io/load.ts";
import { locate } from "./io/locate.ts";
import { seedNewConfig } from "./io/seed.ts";
import { metaOutput } from "./meta.ts";

const argv = process.argv.slice(2);

// Handle --version/--help before anything else: they must short-circuit the TUI
// (which needs a TTY) and run before locate(), which rejects unknown flags.
const meta = metaOutput(argv);
if (meta !== null) {
  console.log(meta);
  process.exit(0);
}

const { target, path: configPath } = locate(argv, process.cwd());
// A new/absent config opens pre-filled with opinionated macOS defaults (and a
// shipped starter prompt file) instead of an empty skeleton.
const initialDraft = (await loadDraft(configPath)) ?? seedNewConfig(target);

// Take over the alternate screen before the first frame, and guarantee the
// terminal is restored on every exit path. No-op when stdout is not a TTY.
const dispose = installFullscreen(createFullscreen(process.stdout));
try {
  const instance = render(<App initialDraft={initialDraft} target={target} />);
  await instance.waitUntilExit();
} finally {
  dispose();
}
