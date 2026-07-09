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

test("an itemAction fires onPress with the cursor index when on a real item", async () => {
  const onPress = vi.fn();
  const { stdin, lastFrame } = render(
    <ListField
      items={items}
      isActive
      onActivate={() => {}}
      onDelete={() => {}}
      itemActions={[{ key: "c", onPress }]}
    />,
  );
  stdin.write("\x1b[B"); // down to c/d
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ c/d"));
  stdin.write("c");
  expect(onPress).toHaveBeenCalledWith(1);
});

test("a built-in key wins: a colliding 'd' itemAction never double-fires", () => {
  const onDelete = vi.fn();
  const onPress = vi.fn();
  const { stdin } = render(
    <ListField
      items={items}
      isActive
      onActivate={() => {}}
      onDelete={onDelete}
      itemActions={[{ key: "d", onPress }]}
    />,
  );
  stdin.write("d");
  expect(onDelete).toHaveBeenCalledWith(0);
  expect(onPress).not.toHaveBeenCalled();
});

test("an itemAction does NOT fire on the trailing add row", async () => {
  const onPress = vi.fn();
  const { stdin, lastFrame } = render(
    <ListField
      items={items}
      isActive
      onActivate={() => {}}
      onDelete={() => {}}
      itemActions={[{ key: "c", onPress }]}
    />,
  );
  stdin.write("\x1b[B"); // down to c/d
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ c/d"));
  stdin.write("\x1b[B"); // down to the + add row
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ + add"));
  stdin.write("c");
  expect(onPress).not.toHaveBeenCalled();
});

test("renders extra action rows after the add row and fires onPress on enter", async () => {
  const onPress = vi.fn();
  const onActivate = vi.fn();
  const { stdin, lastFrame } = render(
    <ListField
      items={items}
      isActive
      onActivate={onActivate}
      onDelete={() => {}}
      extraActions={[{ label: "+ discover repositories…", onPress }]}
    />,
  );
  expect(lastFrame()).toContain("+ discover repositories…");
  stdin.write("\x1b[B"); // c/d
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ c/d"));
  stdin.write("\x1b[B"); // + add
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ + add"));
  stdin.write("\x1b[B"); // + discover
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("▸ + discover repositories…"),
  );
  stdin.write("\r");
  expect(onPress).toHaveBeenCalledOnce();
  // The extra action is not the add row: onActivate must not fire for it.
  expect(onActivate).not.toHaveBeenCalled();
});

test("an itemAction does NOT fire on an extra action row", async () => {
  const onPress = vi.fn();
  const actionPress = vi.fn();
  const { stdin, lastFrame } = render(
    <ListField
      items={items}
      isActive
      onActivate={() => {}}
      onDelete={() => {}}
      itemActions={[{ key: "c", onPress }]}
      extraActions={[{ label: "+ discover repositories…", onPress: actionPress }]}
    />,
  );
  stdin.write("\x1b[B"); // c/d
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ c/d"));
  stdin.write("\x1b[B"); // + add
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ + add"));
  stdin.write("\x1b[B"); // + discover
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("▸ + discover repositories…"),
  );
  stdin.write("c");
  expect(onPress).not.toHaveBeenCalled();
});

test("renders a ● on items marked modified", () => {
  const { lastFrame } = render(
    <ListField
      items={[
        { label: "a", note: undefined, error: undefined },
        { label: "b", note: undefined, error: undefined, modified: true },
      ]}
      isActive
      onActivate={() => {}}
      onDelete={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  const lineB = frame.split("\n").find((l) => l.includes("b")) ?? "";
  expect(lineB).toContain("●");
  const lineA = frame.split("\n").find((l) => l.match(/(^|\s)a(\s|$)/)) ?? "";
  expect(lineA).not.toContain("●");
});
