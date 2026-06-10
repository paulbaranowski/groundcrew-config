import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { CustomSourcesView } from "./CustomSourcesView.tsx";

test("shows the title and the custom sources as read-only json", () => {
  const { lastFrame } = render(
    <CustomSourcesView
      title="Custom task sources"
      value={[{ kind: "shell", name: "jira" }]}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Custom task sources");
  expect(f).toContain("jira");
  expect(f).toContain("read-only");
  expect(f).not.toContain("$EDITOR");
});

test("esc returns to the hub", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <CustomSourcesView title="Custom task sources" value={[]} onBack={onBack} />,
  );
  stdin.write(String.fromCharCode(27)); // esc
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});
