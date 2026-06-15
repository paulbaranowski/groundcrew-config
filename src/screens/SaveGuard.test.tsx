import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { SaveGuard } from "./SaveGuard.tsx";

const ESC = String.fromCharCode(27);

test("renders the labelled prompt and key hints", () => {
  const { lastFrame } = render(
    <SaveGuard
      label="repository"
      onApply={() => {}}
      onDiscard={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Pending repository edits");
  expect(f).toContain("Apply these edits to the draft?");
  expect(f).toContain("[a] Apply");
  expect(f).toContain("[d] Discard");
  expect(f).toContain("[esc] Keep editing");
});

test("a applies, d discards, esc keeps editing", async () => {
  const onApply = vi.fn();
  const onDiscard = vi.fn();
  const onCancel = vi.fn();
  const { stdin } = render(
    <SaveGuard
      label="repository"
      onApply={onApply}
      onDiscard={onDiscard}
      onCancel={onCancel}
    />,
  );
  stdin.write("a");
  await vi.waitFor(() => expect(onApply).toHaveBeenCalled());
  stdin.write("d");
  await vi.waitFor(() => expect(onDiscard).toHaveBeenCalled());
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});
