import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { EscapeHatch } from "./EscapeHatch.tsx";

test("shows the section title and current json", () => {
  const { lastFrame } = render(
    <EscapeHatch
      title="Ticket Sources"
      value={[{ kind: "shell", name: "jira" }]}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("Ticket Sources");
  expect(lastFrame()).toContain("jira");
  expect(lastFrame()).toContain("e edit in $EDITOR");
});
