import { expect, test, vi } from "vitest";
import {
  createFullscreen,
  installFullscreen,
  type FullscreenProcess,
} from "./useFullscreen.ts";

function fakeStdout(isTTY: boolean) {
  const writes: string[] = [];
  return {
    isTTY,
    writes,
    write(data: string) {
      writes.push(data);
      return true;
    },
    get all() {
      return writes.join("");
    },
  };
}

function fakeProcess() {
  const listeners = new Map<string, Set<(...args: never[]) => void>>();
  const exitCodes: number[] = [];
  const proc: FullscreenProcess & {
    listeners: typeof listeners;
    exitCodes: number[];
    emit(event: string, ...args: never[]): void;
  } = {
    listeners,
    exitCodes,
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return proc;
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
      return proc;
    },
    exit(code) {
      exitCodes.push(code ?? 0);
      return undefined as never;
    },
    emit(event, ...args) {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(...args);
    },
  };
  return proc;
}

test("createFullscreen is a no-op when stdout is not a TTY", () => {
  const stdout = fakeStdout(false);
  const fs = createFullscreen(stdout);
  fs.enter();
  fs.exit();
  expect(stdout.writes).toEqual([]);
});

test("enter writes the alt-screen + hide-cursor sequence once", () => {
  const stdout = fakeStdout(true);
  const fs = createFullscreen(stdout);
  fs.enter();
  fs.enter(); // second call must not re-emit
  expect(stdout.all).toContain("\x1b[?1049h");
  expect(stdout.all).toContain("\x1b[?25l");
  expect(stdout.writes).toHaveLength(1);
});

test("exit restores the screen and cursor, and is idempotent", () => {
  const stdout = fakeStdout(true);
  const fs = createFullscreen(stdout);
  fs.enter();
  fs.exit();
  fs.exit(); // double teardown must be safe
  const restore = stdout.writes.slice(1).join("");
  expect(restore).toContain("\x1b[?1049l");
  expect(restore).toContain("\x1b[?25h");
  expect(stdout.writes).toHaveLength(2);
});

test("exit before enter does nothing", () => {
  const stdout = fakeStdout(true);
  const fs = createFullscreen(stdout);
  fs.exit();
  expect(stdout.writes).toEqual([]);
});

test("installFullscreen enters immediately and restores via dispose", () => {
  const stdout = fakeStdout(true);
  const proc = fakeProcess();
  const fs = createFullscreen(stdout);
  const dispose = installFullscreen(fs, proc);

  expect(stdout.all).toContain("\x1b[?1049h");
  // handlers registered for every exit path the plan requires
  for (const event of [
    "exit",
    "SIGINT",
    "SIGTERM",
    "SIGHUP",
    "uncaughtException",
    "unhandledRejection",
  ])
    expect(proc.listeners.get(event)?.size).toBeGreaterThan(0);

  dispose();
  expect(stdout.all).toContain("\x1b[?1049l");
  // every listener removed
  for (const set of proc.listeners.values()) expect(set.size).toBe(0);
});

test("a process 'exit' event restores the terminal", () => {
  const stdout = fakeStdout(true);
  const proc = fakeProcess();
  installFullscreen(createFullscreen(stdout), proc);
  proc.emit("exit");
  expect(stdout.all).toContain("\x1b[?1049l");
});

test("a signal restores the terminal and exits with the conventional code", () => {
  const stdout = fakeStdout(true);
  const proc = fakeProcess();
  installFullscreen(createFullscreen(stdout), proc);
  proc.emit("SIGINT");
  expect(stdout.all).toContain("\x1b[?1049l");
  expect(proc.exitCodes).toContain(130);
});

test("an uncaught error restores the terminal before exiting non-zero", () => {
  const stdout = fakeStdout(true);
  const proc = fakeProcess();
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  installFullscreen(createFullscreen(stdout), proc);
  proc.emit("uncaughtException", new Error("boom") as never);
  expect(stdout.all).toContain("\x1b[?1049l");
  expect(proc.exitCodes).toContain(1);
  errorSpy.mockRestore();
});
