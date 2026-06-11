import { render } from "ink";
import { App } from "./app.tsx";
import { createFullscreen, installFullscreen } from "./hooks/useFullscreen.ts";
import { loadDraft } from "./io/load.ts";
import { locate } from "./io/locate.ts";
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
const initialDraft = await loadDraft(configPath);

// Take over the alternate screen before the first frame, and guarantee the
// terminal is restored on every exit path. No-op when stdout is not a TTY.
const dispose = installFullscreen(createFullscreen(process.stdout));
try {
  const instance = render(<App initialDraft={initialDraft} target={target} />);
  await instance.waitUntilExit();
} finally {
  dispose();
}
