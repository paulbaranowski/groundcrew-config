import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { Wizard } from "./Wizard.tsx";

// A keypress advances the wizard and mounts the next step's field. In a real
// terminal each press triggers a re-render before the next; in tests we must
// yield a tick so the next field is mounted before we type into it.
const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 20));

test("first step asks for scope", () => {
  const { lastFrame } = render(
    <Wizard onComplete={() => {}} onCancel={() => {}} />,
  );
  expect(lastFrame()).toContain("first-run setup");
  expect(lastFrame()).toContain("Where should this config live");
});

test("walking all steps completes with a draft", async () => {
  const onComplete = vi.fn();
  const { stdin } = render(
    <Wizard onComplete={onComplete} onCancel={() => {}} />,
  );
  stdin.write("\r"); // scope: default local
  await tick();
  stdin.write("~/dev/gc"); // projectDir
  await tick();
  stdin.write("\r");
  await tick();
  stdin.write("org/repo"); // repo
  await tick();
  stdin.write("\r");
  await tick();
  stdin.write("\r"); // model: default claude
  await tick();
  stdin.write("\r"); // runner: default auto -> complete
  await tick();
  expect(onComplete).toHaveBeenCalledWith(
    "local",
    expect.objectContaining({
      workspace: { projectDir: "~/dev/gc", knownRepositories: ["org/repo"] },
      models: { default: "claude", definitions: { claude: {} } },
      local: { runner: "auto" },
    }),
  );
});
