import { render } from "ink";
import { App } from "./app.tsx";
import { createFullscreen, installFullscreen } from "./hooks/useFullscreen.ts";
import { loadDraft } from "./io/load.ts";
import { locate } from "./io/locate.ts";

const { target, path: configPath } = locate(process.argv.slice(2), process.cwd());
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
