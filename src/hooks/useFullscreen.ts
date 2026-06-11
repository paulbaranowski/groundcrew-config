import { useEffect, useState } from "react";
import { useStdout } from "ink";

// Alternate-screen + cursor control sequences. Entering 1049h switches to a
// fresh buffer (like vim/lazygit); leaving with 1049l restores the user's prior
// scrollback exactly. We hide the cursor while the TUI owns the screen.
const ENTER_ALT_SCREEN = "\x1b[?1049h";
const LEAVE_ALT_SCREEN = "\x1b[?1049l";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const CLEAR_SCREEN = "\x1b[2J\x1b[H";

/** Floor dimensions so layout math never goes negative on a tiny terminal. */
export const MIN_ROWS = 10;
export const MIN_COLUMNS = 40;

/** Conventional exit codes for the signals we restore on (128 + signal number). */
const SIGNAL_EXIT_CODE: Record<string, number> = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};

const FATAL_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

/** Minimal stdout surface we need — keeps the controller unit-testable with a fake. */
export interface FullscreenStdout {
  write(data: string): unknown;
  isTTY?: boolean;
}

/** Minimal process surface, injectable for tests. Listener shape matches Node's. */
type ProcessListener = (...args: any[]) => void;
export interface FullscreenProcess {
  on(event: string, listener: ProcessListener): unknown;
  off(event: string, listener: ProcessListener): unknown;
  exit(code?: number): never;
}

export interface FullscreenController {
  /** Enter the alternate screen, hide the cursor, clear. No-op when not a TTY. */
  enter(): void;
  /**
   * Restore the normal screen buffer and cursor. Idempotent and safe to call
   * from any number of teardown paths; no-op when we never entered.
   */
  exit(): void;
}

/**
 * Create a fullscreen controller bound to a stdout. All writes are guarded by
 * `isTTY`, so piping or a test buffer emits nothing. `exit()` is idempotent: it
 * only restores if `enter()` actually ran and hasn't been restored yet.
 */
export function createFullscreen(stdout: FullscreenStdout): FullscreenController {
  let entered = false;
  let restored = false;
  return {
    enter() {
      if (!stdout.isTTY || entered) return;
      entered = true;
      stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR + CLEAR_SCREEN);
    },
    exit() {
      // `entered` is only ever true when isTTY was true at enter time, so this
      // implicitly no-ops off-TTY without re-checking isTTY (which could have
      // changed). `restored` makes double-invocation harmless.
      if (!entered || restored) return;
      restored = true;
      stdout.write(SHOW_CURSOR + LEAVE_ALT_SCREEN);
    },
  };
}

/**
 * Enter fullscreen and wire restoration to every exit path: normal `exit`,
 * Ctrl-C / kill signals, and uncaught errors. Returns a disposer that restores
 * and unregisters everything (call it after Ink's `waitUntilExit()`).
 *
 * The `process.on('exit')` handler is the real safety net — it runs on any
 * terminating path Node still controls — while the signal/error handlers add a
 * restore for cases where the process would otherwise die without Ink
 * unmounting (SIGTERM/SIGHUP, a thrown error).
 */
export function installFullscreen(
  controller: FullscreenController,
  proc: FullscreenProcess = process,
): () => void {
  const restore = (): void => controller.exit();

  const onSignal = (signal: string): void => {
    restore();
    proc.exit(SIGNAL_EXIT_CODE[signal] ?? 1);
  };
  // Bind one listener per signal so we can remove the exact references later.
  const signalListeners = FATAL_SIGNALS.map(
    (signal) => [signal, () => onSignal(signal)] as const,
  );

  const onFatalError = (error: unknown): void => {
    restore();
    // The terminal is restored now, so the error is actually visible.
    console.error(error);
    proc.exit(1);
  };

  proc.on("exit", restore);
  for (const [signal, listener] of signalListeners) proc.on(signal, listener);
  proc.on("uncaughtException", onFatalError);
  proc.on("unhandledRejection", onFatalError);

  // Enter only after every restore path is wired, so a fatal event during
  // startup can never strand the terminal in the alt screen.
  controller.enter();

  return () => {
    restore();
    proc.off("exit", restore);
    for (const [signal, listener] of signalListeners) proc.off(signal, listener);
    proc.off("uncaughtException", onFatalError);
    proc.off("unhandledRejection", onFatalError);
  };
}

function readSize(stdout: { rows?: number; columns?: number } | undefined): {
  rows: number;
  columns: number;
} {
  return {
    rows: Math.max(stdout?.rows ?? 24, MIN_ROWS),
    columns: Math.max(stdout?.columns ?? 80, MIN_COLUMNS),
  };
}

/**
 * Track the terminal's dimensions, re-reading on `resize`. Off-TTY (pipes, the
 * test renderer) it returns sane defaults and never subscribes — so the layout
 * has finite numbers to work with and nothing leaks into non-interactive output.
 */
export function useFullscreen(): { rows: number; columns: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => readSize(stdout));

  useEffect(() => {
    if (!stdout?.isTTY) return;
    const onResize = (): void => setSize(readSize(stdout));
    onResize();
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
