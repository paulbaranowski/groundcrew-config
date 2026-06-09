import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { TicketSourcesMenu } from "./TicketSourcesMenu.tsx";

const draft = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;
const ESC = "";

test("lists Linear, PlanKeeper and Custom with statuses", () => {
  const { lastFrame } = render(
    <TicketSourcesMenu draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Linear");
  expect(lastFrame()).toContain("PlanKeeper");
  expect(lastFrame()).toContain("Custom");
});

test("enter opens the Linear sub-screen; esc returns to the hub", async () => {
  const { lastFrame, stdin } = render(
    <TicketSourcesMenu draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  stdin.write("\r"); // open Linear (first row)
  await vi.waitFor(() => expect(lastFrame()).toContain("Built-in Linear source"));
  stdin.write(ESC); // back to hub
  await vi.waitFor(() => expect(lastFrame()).toContain("PlanKeeper"));
});

test("esc on the hub calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <TicketSourcesMenu draft={draft} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});
