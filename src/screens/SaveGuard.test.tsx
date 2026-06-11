import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { SaveGuard } from "./SaveGuard.tsx";

const ESC = String.fromCharCode(27);

test("renders the labelled prompt and key hints", () => {
  const { lastFrame } = render(
    <SaveGuard
      label="repository"
      onSave={() => {}}
      onDiscard={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Unsaved repository");
  expect(f).toContain("[s] Save");
  expect(f).toContain("[d] Discard");
  expect(f).toContain("[esc] Keep editing");
});

test("s saves, d discards, esc keeps editing", async () => {
  const onSave = vi.fn();
  const onDiscard = vi.fn();
  const onCancel = vi.fn();
  const { stdin } = render(
    <SaveGuard onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />,
  );
  stdin.write("s");
  await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
  stdin.write("d");
  await vi.waitFor(() => expect(onDiscard).toHaveBeenCalled());
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});
