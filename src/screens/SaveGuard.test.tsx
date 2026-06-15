import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { SaveGuard } from "./SaveGuard.tsx";

const ESC = String.fromCharCode(27);

test("renders the prompt and key hints", () => {
  const { lastFrame } = render(
    <SaveGuard
      onApply={() => {}}
      onDiscard={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Save these edits to current draft config?");
  expect(f).toContain("(will not save to disk)");
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
