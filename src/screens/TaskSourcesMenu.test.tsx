import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import type { CatalogSource } from "../domain/manifestSources.ts";
import { TaskSourcesMenu } from "./TaskSourcesMenu.tsx";

const draft = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;
const ESC = "";

// Deterministic default for tests: an empty catalog, i.e. the static hub. The
// real default prop would hit the installed groundcrew's discovery.
const noCatalog = async (): Promise<CatalogSource[]> => [];

const jiraCatalog: CatalogSource = {
  name: "jira",
  description: "Feed JIRA issues into groundcrew via the jira CLI.",
  origin: "package",
  requiresCredentials: true,
  manifest: {
    name: "jira",
    installDir: "~/.config/groundcrew",
    prerequisites: [],
    secrets: [],
    env: {},
  },
};

test("lists Linear, todo-txt, PlanKeeper and Shell sources", () => {
  const { lastFrame } = render(
    <TaskSourcesMenu
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={noCatalog}
    />,
  );
  expect(lastFrame()).toContain("Task Sources");
  expect(lastFrame()).toContain("Linear");
  expect(lastFrame()).toContain("todo-txt");
  expect(lastFrame()).toContain("PlanKeeper");
  expect(lastFrame()).toContain("Shell sources");
  expect(lastFrame()).not.toContain("Custom");
});

test("shows each shell source's name inline on the Shell sources row", () => {
  const draftWithShell = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
      { kind: "shell", name: "github", commands: { listTasks: "gh ls" } },
    ],
  } as never;
  const { lastFrame } = render(
    <TaskSourcesMenu
      draft={draftWithShell}
      baseline={draftWithShell}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={noCatalog}
    />,
  );
  const frame = lastFrame() ?? "";
  const shellLine = frame.split("\n").find((l) => l.includes("Shell sources")) ?? "";
  expect(shellLine).toContain("jira");
  expect(shellLine).toContain("github");
});

test("shows 'none' on the Shell sources row when no shell sources are configured", () => {
  const { lastFrame } = render(
    <TaskSourcesMenu
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={noCatalog}
    />,
  );
  const frame = lastFrame() ?? "";
  const shellLine = frame.split("\n").find((l) => l.includes("Shell sources")) ?? "";
  expect(shellLine).toContain("none");
});

test("enter opens todo-txt; esc returns to the hub", async () => {
  const { lastFrame, stdin } = render(
    <TaskSourcesMenu
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={noCatalog}
    />,
  );
  stdin.write("[B"); // down to todo-txt (row 2)
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("todo-txt source:"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("PlanKeeper"));
});

test("esc on the hub calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <TaskSourcesMenu
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={onBack}
      loadCatalog={noCatalog}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("shows the ● marker on rows whose source slice differs from baseline", () => {
  // Baseline has Linear off; draft has it on. Only the Linear row should
  // carry the ● — todo-txt / PlanKeeper / Shell are unchanged.
  const draftWithLinear = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "linear" }],
  } as never;
  const { lastFrame } = render(
    <TaskSourcesMenu
      draft={draftWithLinear}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={noCatalog}
    />,
  );
  const frame = lastFrame() ?? "";
  const linearLine = frame.split("\n").find((l) => l.includes("Linear")) ?? "";
  expect(linearLine).toContain("●");
  const todoLine = frame.split("\n").find((l) => l.includes("todo-txt")) ?? "";
  expect(todoLine).not.toContain("●");
});

test("appends discovered catalog sources as rows once the catalog resolves", async () => {
  const { lastFrame } = render(
    <TaskSourcesMenu
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={async () => [jiraCatalog]}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("jira"));
  const frame = lastFrame() ?? "";
  const labels = frame.split("\n").filter((l) => /Linear|todo-txt|jira|PlanKeeper|Shell/.test(l));
  // jira sits between the builtins and the PlanKeeper/Shell tail.
  expect(labels.findIndex((l) => l.includes("jira"))).toBeGreaterThan(
    labels.findIndex((l) => l.includes("todo-txt")),
  );
  expect(labels.findIndex((l) => l.includes("jira"))).toBeLessThan(
    labels.findIndex((l) => l.includes("PlanKeeper")),
  );
});

test("enter on a discovered row opens the generic manifest screen; esc returns", async () => {
  const { lastFrame, stdin } = render(
    <TaskSourcesMenu
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      loadCatalog={async () => [jiraCatalog]}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("jira"));
  stdin.write("[B");
  stdin.write("[B"); // down twice: Linear, todo-txt, jira
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("package source"));
  expect(lastFrame()).toContain("Feed JIRA issues");
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("PlanKeeper"));
});
