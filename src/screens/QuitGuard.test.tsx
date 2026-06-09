import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { QuitGuard } from "./QuitGuard.tsx";

test("renders the three choices", () => {
  const { lastFrame } = render(
    <QuitGuard onSaveQuit={() => {}} onDiscard={() => {}} onCancel={() => {}} />,
  );
  expect(lastFrame()).toContain("Unsaved changes");
  expect(lastFrame()).toContain("Save & quit");
});

test("s triggers save & quit", () => {
  const onSaveQuit = vi.fn();
  const { stdin } = render(
    <QuitGuard
      onSaveQuit={onSaveQuit}
      onDiscard={() => {}}
      onCancel={() => {}}
    />,
  );
  stdin.write("s");
  expect(onSaveQuit).toHaveBeenCalled();
});
