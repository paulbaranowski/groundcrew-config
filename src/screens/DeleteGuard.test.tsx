import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { DeleteGuard } from "./DeleteGuard.tsx";

test("renders the delete confirmation prompt with the name", () => {
  const { lastFrame } = render(
    <DeleteGuard name="maple" onConfirm={() => {}} onCancel={() => {}} />,
  );
  expect(lastFrame()).toContain("Delete maple?");
  expect(lastFrame()).toContain("[y] Delete");
  expect(lastFrame()).toContain("[esc] Cancel");
});

test("y confirms the delete", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const { stdin } = render(
    <DeleteGuard name="maple" onConfirm={onConfirm} onCancel={onCancel} />,
  );
  stdin.write("y");
  await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  expect(onCancel).not.toHaveBeenCalled();
});

test("enter confirms the delete", async () => {
  const onConfirm = vi.fn();
  const { stdin } = render(
    <DeleteGuard name="maple" onConfirm={onConfirm} onCancel={() => {}} />,
  );
  stdin.write("\r");
  await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
});

test("esc cancels", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const { stdin } = render(
    <DeleteGuard name="maple" onConfirm={onConfirm} onCancel={onCancel} />,
  );
  stdin.write("\x1b");
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
  expect(onConfirm).not.toHaveBeenCalled();
});
