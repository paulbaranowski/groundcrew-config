import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { Wizard } from "./Wizard.tsx";

test("first step asks for scope", () => {
  const { lastFrame } = render(
    <Wizard onComplete={() => {}} onCancel={() => {}} />,
  );
  expect(lastFrame()).toContain("first-run setup");
  expect(lastFrame()).toContain("Where should this config live");
});

test("walking all steps completes with a draft", async () => {
  const onComplete = vi.fn();
  const { stdin, lastFrame } = render(
    <Wizard onComplete={onComplete} onCancel={() => {}} />,
  );
  // A keypress advances the wizard and mounts the next step's field. Wait for
  // each step to render (rather than a fixed sleep) so the walk is robust under
  // load — otherwise we'd type into a field that hasn't mounted yet.
  const waitForStep = (text: string): Promise<void> =>
    vi.waitFor(() => expect(lastFrame()).toContain(text));

  stdin.write("\r"); // scope: default local
  await waitForStep("Project directory");
  stdin.write("~/dev/gc"); // projectDir
  await waitForStep("~/dev/gc");
  stdin.write("\r");
  await waitForStep("Add a repository");
  stdin.write("org/repo"); // repo
  await waitForStep("org/repo");
  stdin.write("\r");
  await waitForStep("Default agent model");
  stdin.write("\r"); // model: default claude
  await waitForStep("Sandbox runner");
  stdin.write("\r"); // runner: default auto -> complete
  await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
  expect(onComplete).toHaveBeenCalledWith(
    "local",
    expect.objectContaining({
      workspace: { projectDir: "~/dev/gc", knownRepositories: ["org/repo"] },
      models: { default: "claude", definitions: { claude: {} } },
      local: { runner: "auto" },
    }),
  );
});
