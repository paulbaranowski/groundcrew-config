import { expect, test } from "vitest";
import {
  customSourceCount,
  customSources,
  enabledSourceCount,
  getLinearField,
  getLinearStatuses,
  getTodoTxtField,
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  planKeeperCommands,
  planKeeperSource,
  applyShellFields,
  readShellEnv,
  readShellFields,
  setLinearEnabled,
  setLinearField,
  setLinearStatuses,
  setPlanKeeperEnabled,
  setShellSources,
  setTodoTxtEnabled,
  setTodoTxtField,
  shellListTasksCommand,
  shellSourceCount,
  shellSources,
  readShellSandboxPaths,
  taskSourceModified,
  todoTxtSource,
} from "./sources.ts";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("linear is off by default; enable adds {kind:linear}; disable removes it", () => {
  expect(isLinearEnabled(base)).toBe(false);
  const on = setLinearEnabled(base, true);
  expect(on.sources).toEqual([{ kind: "linear" }]);
  expect(isLinearEnabled(on)).toBe(true);
  const off = setLinearEnabled(on, false);
  expect(off.sources).toEqual([]);
  expect(isLinearEnabled(off)).toBe(false);
});

test("a loaded {kind:linear,enabled:false} reads as disabled", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "linear", enabled: false }],
  } as never;
  expect(isLinearEnabled(draft)).toBe(false);
});

test("linear team/name get/set patch the linear entry", () => {
  let draft = setLinearEnabled(base, true);
  draft = setLinearField(draft, "team", "ENG");
  draft = setLinearField(draft, "name", "linear-eng");
  expect(draft.sources).toEqual([
    { kind: "linear", team: "ENG", name: "linear-eng" },
  ]);
  expect(getLinearField(draft, "team")).toBe("ENG");
  draft = setLinearField(draft, "team", "");
  expect(getLinearField(draft, "team")).toBeUndefined();
});

test("linear status overrides parse comma lists and drop blanks", () => {
  let draft = setLinearEnabled(base, true);
  draft = setLinearStatuses(draft, "inProgress", "Doing, In Progress ,");
  draft = setLinearStatuses(draft, "inReview", "Code Review");
  expect(draft.sources).toEqual([
    {
      kind: "linear",
      statuses: { inProgress: ["Doing", "In Progress"], inReview: ["Code Review"] },
    },
  ]);
  expect(getLinearStatuses(draft, "inProgress")).toBe("Doing, In Progress");
});

test("clearing both linear status overrides removes the statuses object", () => {
  let draft = setLinearEnabled(base, true);
  draft = setLinearStatuses(draft, "inProgress", "Doing");
  draft = setLinearStatuses(draft, "inReview", "Review");
  draft = setLinearStatuses(draft, "inProgress", "");
  draft = setLinearStatuses(draft, "inReview", "  ");
  expect(draft.sources).toEqual([{ kind: "linear" }]);
});

test("todo-txt enable adds {kind:todo-txt}; disable removes it", () => {
  expect(isTodoTxtEnabled(base)).toBe(false);
  const on = setTodoTxtEnabled(base, true);
  expect(on.sources).toEqual([todoTxtSource()]);
  expect(isTodoTxtEnabled(on)).toBe(true);
  const off = setTodoTxtEnabled(on, false);
  expect(off.sources).toEqual([]);
});

test("todo-txt field get/set on the todo-txt entry", () => {
  let draft = setTodoTxtEnabled(base, true);
  draft = setTodoTxtField(draft, "todoPath", "~/todo.txt");
  expect(getTodoTxtField(draft, "todoPath")).toBe("~/todo.txt");
  draft = setTodoTxtField(draft, "todoPath", "");
  expect(getTodoTxtField(draft, "todoPath")).toBeUndefined();
});

test("todo-txt get/set covers defaultRepository, idPrefix, and timezone", () => {
  let draft = setTodoTxtEnabled(base, true);
  draft = setTodoTxtField(draft, "defaultRepository", "a/b");
  draft = setTodoTxtField(draft, "idPrefix", "ACME");
  draft = setTodoTxtField(draft, "timezone", "America/New_York");
  expect(draft.sources).toEqual([
    {
      kind: "todo-txt",
      defaultRepository: "a/b",
      idPrefix: "ACME",
      timezone: "America/New_York",
    },
  ]);
  draft = setTodoTxtField(draft, "idPrefix", "");
  expect(getTodoTxtField(draft, "idPrefix")).toBeUndefined();
});

test("enabledSourceCount counts non-disabled entries", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "todo-txt" },
      { kind: "shell", name: "x", enabled: false },
    ],
  } as never;
  expect(enabledSourceCount(draft)).toBe(2);
  expect(enabledSourceCount(base)).toBe(0);
});

test("a generic shell source is managed (shell bucket), not custom", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "todo-txt" },
      { kind: "shell", name: "plankeeper" },
      { kind: "shell", name: "jira" },
    ],
  } as never;
  // jira is a generic shell source; plankeeper has its own screen.
  expect(shellSourceCount(draft)).toBe(1);
  // The raw-JSON custom bucket is now only for non-shell, unmanaged kinds.
  expect(customSourceCount(draft)).toBe(0);
});

test("planKeeperSource uses the new 'plankeeper' name", () => {
  const s = planKeeperSource() as {
    name: string;
    commands: Record<string, string>;
  };
  expect(s.name).toBe("plankeeper");
  expect(s.commands.fetch).toBe("plan-keeper crew fetch");
});

test("isPlanKeeperEnabled / setPlanKeeperEnabled round-trip", () => {
  expect(isPlanKeeperEnabled(base)).toBe(false);
  const on = setPlanKeeperEnabled(base, true);
  expect(isPlanKeeperEnabled(on)).toBe(true);
  expect(setPlanKeeperEnabled(on, false).sources).toEqual([]);
});

test("a {kind:shell,name:plans} entry is NOT plan-keeper (legacy name dropped)", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "shell", name: "plans" }],
  } as never;
  expect(isPlanKeeperEnabled(draft)).toBe(false);
  // A non-plankeeper shell is a generic shell source, not a raw-JSON custom one.
  expect(customSourceCount(draft)).toBe(0);
  expect(shellSourceCount(draft)).toBe(1);
});

test("shellSources / setShellSources manage generic shell entries only", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "shell", name: "plankeeper" },
      { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
    ],
  } as never;
  expect(shellSources(draft).map((s) => (s as { name: string }).name)).toEqual([
    "jira",
  ]);
  // Replacing the generic shells leaves linear + plankeeper untouched.
  const next = setShellSources(draft, [
    { kind: "shell", name: "gitlab", commands: { listTasks: "glab ls" } },
  ] as never);
  expect(next.sources).toEqual([
    { kind: "linear" },
    { kind: "shell", name: "plankeeper" },
    { kind: "shell", name: "gitlab", commands: { listTasks: "glab ls" } },
  ]);
});

test("shellListTasksCommand returns commands.listTasks when present", () => {
  expect(
    shellListTasksCommand({
      kind: "shell",
      name: "jira",
      commands: { listTasks: "jira ls", fetch: "legacy" },
    } as never),
  ).toBe("jira ls");
});

test("shellListTasksCommand falls back to the legacy commands.fetch alias", () => {
  expect(
    shellListTasksCommand({
      kind: "shell",
      name: "jira",
      commands: { fetch: "jira ls" },
    } as never),
  ).toBe("jira ls");
});

test("shellListTasksCommand returns undefined for missing/non-string/non-shell", () => {
  // No listTasks or fetch command on the shell source.
  expect(
    shellListTasksCommand({ kind: "shell", name: "jira", commands: {} } as never),
  ).toBeUndefined();
  // A non-string command value is not returned.
  expect(
    shellListTasksCommand({
      kind: "shell",
      name: "jira",
      commands: { listTasks: 42 },
    } as never),
  ).toBeUndefined();
  // A non-shell kind never lists tasks through this helper.
  expect(shellListTasksCommand({ kind: "linear" } as never)).toBeUndefined();
  // A malformed shell source with no `commands` object does not throw.
  expect(
    shellListTasksCommand({ kind: "shell", name: "jira" } as never),
  ).toBeUndefined();
});

test("structural helpers partition a mixed sources array consistently", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "todo-txt" },
      { kind: "shell", name: "plankeeper" },
      { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
      { kind: "webhook" },
    ],
  } as never;
  // plan-keeper is detected via its name; only it is "plan-keeper enabled".
  expect(isPlanKeeperEnabled(draft)).toBe(true);
  // shellSources is the generic-shell bucket — plankeeper is excluded.
  expect(shellSources(draft).map((s) => (s as { name: string }).name)).toEqual([
    "jira",
  ]);
  // customSources holds only the unmanaged, non-shell kinds.
  expect(customSources(draft)).toEqual([{ kind: "webhook" }]);
});

test("readShellFields / applyShellFields round-trip preferred command names", () => {
  const fields = readShellFields({
    kind: "shell",
    name: "jira",
    commands: { fetch: "jira ls", resolveOne: "jira get ${id}" },
    cwd: "~/jira",
  } as never);
  // Legacy aliases surface in the preferred fields…
  expect(fields.listTasks).toBe("jira ls");
  expect(fields.getTask).toBe("jira get ${id}");

  const built = applyShellFields(
    { kind: "shell", name: "jira", commands: { fetch: "jira ls" }, timeouts: { fetch: 60_000 } } as never,
    { ...fields, markInProgress: "jira start ${id}" },
  );
  // …and apply writes preferred names, drops the aliases, preserves timeouts.
  expect(built).toEqual({
    kind: "shell",
    name: "jira",
    commands: {
      listTasks: "jira ls",
      getTask: "jira get ${id}",
      markInProgress: "jira start ${id}",
    },
    cwd: "~/jira",
    timeouts: { fetch: 60_000 },
  });
});

test("readShellFields / applyShellFields round-trip createTask and validate", () => {
  const fields = readShellFields({
    kind: "shell",
    name: "jira",
    commands: {
      listTasks: "jira ls",
      createTask: "jira new ${title}",
      validate: "jira lint",
    },
  } as never);
  expect(fields.createTask).toBe("jira new ${title}");
  expect(fields.validate).toBe("jira lint");

  const built = applyShellFields(undefined, fields) as {
    commands: Record<string, string>;
  };
  expect(built.commands.createTask).toBe("jira new ${title}");
  expect(built.commands.validate).toBe("jira lint");
});

test("planKeeperCommands reads the live entry's commands as ordered pairs", () => {
  expect(planKeeperCommands(base)).toBeUndefined();
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      {
        kind: "shell",
        name: "plankeeper",
        commands: {
          fetch: "/opt/homebrew/bin/plan-keeper crew fetch",
          resolveOne: "/opt/homebrew/bin/plan-keeper crew get ${id}",
        },
      },
    ],
  } as never;
  expect(planKeeperCommands(draft)).toEqual([
    ["fetch", "/opt/homebrew/bin/plan-keeper crew fetch"],
    ["resolveOne", "/opt/homebrew/bin/plan-keeper crew get ${id}"],
  ]);
});

test("customSources excludes managed entries", () => {
  // `webhook` stands in for an unmanaged (non-linear/todo-txt/shell) kind — the
  // only thing that falls outside the managed buckets now that shell is managed.
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "shell", name: "plankeeper" },
      { kind: "shell", name: "jira" },
      { kind: "webhook" },
    ],
  } as never;
  expect(customSources(draft)).toEqual([{ kind: "webhook" }]);
  expect(customSourceCount(draft)).toBe(1);
});

test("planKeeperCommands returns undefined for a null commands payload", () => {
  // typeof null === "object", so an unguarded Object.entries(null) would throw.
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "shell", name: "plankeeper", commands: null }],
  } as never;
  expect(planKeeperCommands(draft)).toBeUndefined();
});

test("readShellEnv reads the env map as ordered entries; non-object → []", () => {
  expect(
    readShellEnv({
      kind: "shell",
      name: "jira",
      env: { JIRA_HOST: "jira.example.com", JIRA_TOKEN: "secret" },
    } as never),
  ).toEqual([
    { key: "JIRA_HOST", value: "jira.example.com" },
    { key: "JIRA_TOKEN", value: "secret" },
  ]);
  expect(readShellEnv(undefined)).toEqual([]);
  // typeof null === "object", so a null env must not reach Object.entries.
  expect(readShellEnv({ kind: "shell", env: null } as never)).toEqual([]);
});

test("readShellFields surfaces env and applyShellFields writes it back", () => {
  const fields = readShellFields({
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    env: { JIRA_HOST: "jira.example.com" },
  } as never);
  expect(fields.env).toEqual([{ key: "JIRA_HOST", value: "jira.example.com" }]);

  const built = applyShellFields(undefined, {
    ...fields,
    env: [
      { key: "JIRA_HOST", value: "jira.example.com" },
      { key: "JIRA_TOKEN", value: "secret" },
    ],
  }) as { env?: Record<string, string> };
  expect(built.env).toEqual({
    JIRA_HOST: "jira.example.com",
    JIRA_TOKEN: "secret",
  });
});

test("applyShellFields drops blank-key env entries, last write wins, empty → no env key", () => {
  const fields = readShellFields(undefined);
  // A blank key is dropped; a duplicate key keeps the later value.
  const built = applyShellFields(undefined, {
    ...fields,
    name: "jira",
    listTasks: "jira ls",
    env: [
      { key: "  ", value: "ignored" },
      { key: "A", value: "first" },
      { key: "A", value: "second" },
    ],
  }) as { env?: Record<string, string> };
  expect(built.env).toEqual({ A: "second" });

  // An all-blank/empty list removes the env key entirely (prune-friendly).
  const cleared = applyShellFields(
    { kind: "shell", name: "jira", env: { A: "x" } } as never,
    { ...fields, name: "jira", listTasks: "jira ls", env: [] },
  ) as Record<string, unknown>;
  expect("env" in cleared).toBe(false);
});

test("taskSourceModified flags each row independently against baseline", () => {
  // Identical draft and baseline: nothing modified.
  expect(taskSourceModified(base, base)).toEqual({
    linear: false,
    todoTxt: false,
    planKeeper: false,
    shell: false,
  });

  // Enabling Linear flips just the linear flag (this is the bug we're fixing).
  const linearOn = setLinearEnabled(base, true);
  expect(taskSourceModified(linearOn, base)).toEqual({
    linear: true,
    todoTxt: false,
    planKeeper: false,
    shell: false,
  });

  // Toggling other rows is symmetric and independent.
  expect(taskSourceModified(setTodoTxtEnabled(base, true), base).todoTxt).toBe(true);
  expect(taskSourceModified(setPlanKeeperEnabled(base, true), base).planKeeper).toBe(true);

  // Editing a Linear sub-field also counts the Linear row as modified.
  const linearWithTeam = setLinearField(linearOn, "team", "infra");
  expect(taskSourceModified(linearWithTeam, linearOn).linear).toBe(true);

  // Shell row reacts to any change inside any shell source.
  const shellOnly = setShellSources(base, [
    { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
  ] as never);
  expect(taskSourceModified(shellOnly, base).shell).toBe(true);
});

test("readShellSandboxPaths reads string entries; missing/non-array → []", () => {
  expect(
    readShellSandboxPaths({
      kind: "shell",
      name: "plankeeper",
      sandboxWritePaths: ["~/plans", "/abs/path"],
    } as never),
  ).toEqual(["~/plans", "/abs/path"]);
  expect(readShellSandboxPaths(undefined)).toEqual([]);
  expect(readShellSandboxPaths({ kind: "shell", name: "x" } as never)).toEqual([]);
  // Non-string entries are dropped (hand-edited JSON could include junk).
  expect(
    readShellSandboxPaths({
      kind: "shell",
      name: "x",
      sandboxWritePaths: ["~/plans", 42, null],
    } as never),
  ).toEqual(["~/plans"]);
});

test("readShellFields surfaces sandboxWritePaths and applyShellFields writes it back", () => {
  const fields = readShellFields({
    kind: "shell",
    name: "plankeeper",
    commands: { listTasks: "plan-keeper crew fetch" },
    sandboxWritePaths: ["~/plans"],
  } as never);
  expect(fields.sandboxWritePaths).toEqual(["~/plans"]);

  const built = applyShellFields(undefined, {
    ...fields,
    sandboxWritePaths: ["~/plans", "/abs/path"],
  }) as { sandboxWritePaths?: string[] };
  expect(built.sandboxWritePaths).toEqual(["~/plans", "/abs/path"]);
});

test("applyShellFields trims sandboxWritePaths rows, drops blanks, empty → no key", () => {
  const fields = readShellFields(undefined);
  // Whitespace-only rows are dropped; surrounding whitespace is trimmed.
  const built = applyShellFields(undefined, {
    ...fields,
    name: "plankeeper",
    listTasks: "plan-keeper crew fetch",
    sandboxWritePaths: ["  ", "  ~/plans  ", ""],
  }) as { sandboxWritePaths?: string[] };
  expect(built.sandboxWritePaths).toEqual(["~/plans"]);

  // An all-blank/empty list removes the key entirely (prune-friendly).
  const cleared = applyShellFields(
    {
      kind: "shell",
      name: "plankeeper",
      commands: {},
      sandboxWritePaths: ["~/plans"],
    } as never,
    {
      ...fields,
      name: "plankeeper",
      listTasks: "plan-keeper crew fetch",
      sandboxWritePaths: [],
    },
  ) as Record<string, unknown>;
  expect("sandboxWritePaths" in cleared).toBe(false);
});
