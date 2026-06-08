import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ListField } from "./ListField.tsx";

const items = [
  { label: "a/b", note: undefined, error: undefined },
  { label: "c/d", note: "→ at ~/work", error: "duplicate repository name" },
];

test("renders items, notes, errors, and an add row", () => {
  const { lastFrame } = render(
    <ListField
      items={items}
      isActive
      onActivate={() => {}}
      onDelete={() => {}}
    />,
  );
  expect(lastFrame()).toContain("a/b");
  expect(lastFrame()).toContain("→ at ~/work");
  expect(lastFrame()).toContain("duplicate");
  expect(lastFrame()).toContain("+ add");
});

test("enter on the add row activates index === length", () => {
  const onActivate = vi.fn();
  const { stdin } = render(
    <ListField
      items={items}
      isActive
      onActivate={onActivate}
      onDelete={() => {}}
    />,
  );
  stdin.write("[B"); // to c/d
  stdin.write("[B"); // to + add
  stdin.write("\r");
  expect(onActivate).toHaveBeenCalledWith(2);
});

test("d deletes the focused entry", () => {
  const onDelete = vi.fn();
  const { stdin } = render(
    <ListField
      items={items}
      isActive
      onActivate={() => {}}
      onDelete={onDelete}
    />,
  );
  stdin.write("d");
  expect(onDelete).toHaveBeenCalledWith(0);
});
