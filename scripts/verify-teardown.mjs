#!/usr/bin/env node
// Manual verification that the full-screen TUI restores the terminal on every
// exit path. Runs the built CLI under a pseudo-terminal (via `script(1)`, which
// makes stdout a TTY so the alt screen is actually entered), delivers a signal,
// and asserts the captured bytes contain both the alt-screen ENTER and LEAVE
// sequences plus the cursor-show — i.e. the terminal was not left stranded.
//
// Not part of `npm test`: it spawns real processes with timing and needs a
// build first. Run it by hand after touching src/hooks/useFullscreen.ts:
//
//   npm run build && node scripts/verify-teardown.mjs
//
// Exits non-zero if any path fails to restore.
import { spawn, execSync } from "node:child_process";

const ENTER = "\x1b[?1049h";
const LEAVE = "\x1b[?1049l";
const SHOW_CURSOR = "\x1b[?25h";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSignalCase(signal) {
  const child = spawn("script", ["-q", "/dev/null", "node", "dist/cli.js"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  let buf = "";
  child.stdout.on("data", (d) => (buf += d.toString("binary")));
  await sleep(1000); // let Ink mount and enter the alt screen

  // Signal only the node process (not the `script` wrapper), so `script` stays
  // alive to relay node's restore bytes back through the pipe.
  const pids = execSync("pgrep -f 'dist/cli.js'").toString().trim().split("\n");
  for (const pid of pids) {
    const cmd = execSync(`ps -o command= -p ${pid}`).toString().trim();
    if (cmd.startsWith("node")) process.kill(Number(pid), signal);
  }

  await new Promise((resolve) => child.on("exit", resolve));
  await sleep(150);
  return {
    name: signal,
    entered: buf.includes(ENTER),
    left: buf.includes(LEAVE),
    cursorShown: buf.includes(SHOW_CURSOR),
  };
}

const results = [];
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  results.push(await runSignalCase(sig));
}

let allOk = true;
for (const r of results) {
  const ok = r.entered && r.left && r.cursorShown;
  allOk &&= ok;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${r.name}: entered=${r.entered} left=${r.left} cursorShown=${r.cursorShown}`,
  );
}

if (!allOk) {
  console.error("\nA terminal-restore path failed — the alt screen may be left stranded.");
  process.exit(1);
}
console.log("\nAll exit paths restore the terminal.");
