import { render } from "ink";
import { App } from "./app.tsx";
import { createFullscreen, installFullscreen } from "./hooks/useFullscreen.ts";
import { loadDraft } from "./io/load.ts";
import { locate } from "./io/locate.ts";
import { seedNewConfig } from "./io/seed.ts";
import { runDoctor } from "./io/setup/doctor.ts";
import { runUpgrade } from "./io/upgrade.ts";
import { metaOutput } from "./meta.ts";

const argv = process.argv.slice(2);

// Handle --version/--help before anything else: they must short-circuit the TUI
// (which needs a TTY) and run before locate(), which rejects unknown flags.
const meta = metaOutput(argv);
if (meta !== null) {
  console.log(meta);
  process.exit(0);
}

// `crew-config upgrade` is a non-interactive subcommand: it spawns the right
// channel's upgrade and exits. Like the meta flags, it must short-circuit
// before locate() (which would mistake the bare `upgrade` arg for a config
// path) and before entering the alt screen.
if (argv[0] === "upgrade") {
  process.exit(runUpgrade());
}

// `crew-config doctor [--json]` is a non-interactive, read-only subcommand:
// it probes the machine setup and exits non-zero when something is broken.
// Like `upgrade`, it must short-circuit before locate() (which would mistake
// the bare `doctor` arg for a config path) and before entering the alt screen.
if (argv[0] === "doctor") {
  const code = await runDoctor(argv.slice(1));
  // Drain stdout before exiting: when stdout is a pipe (`doctor --json | jq`)
  // writes are async, and a bare process.exit() can truncate the tail of the
  // report. Writes are ordered, so an empty write's callback fires only after
  // everything queued before it has flushed.
  await new Promise<void>((resolve) => {
    process.stdout.write("", () => resolve());
  });
  process.exit(code);
}

const { target, path: configPath } = locate(argv, process.cwd());
// A new/absent config opens pre-filled with opinionated macOS defaults (and a
// shipped starter prompt file) instead of an empty skeleton.
const initialDraft = (await loadDraft(configPath)) ?? seedNewConfig(target);

// Take over the alternate screen before the first frame, and guarantee the
// terminal is restored on every exit path. No-op when stdout is not a TTY.
// installFullscreen wires every restore handler before it calls enter(): that
// order is load-bearing, so a fatal event during startup can never strand the
// terminal in the alt screen. Any edit to the teardown path must re-run
// `node scripts/verify-teardown.mjs` (after `npm run build`).
const dispose = installFullscreen(createFullscreen(process.stdout));
try {
  const instance = render(<App initialDraft={initialDraft} target={target} />);
  await instance.waitUntilExit();
} finally {
  dispose();
}
