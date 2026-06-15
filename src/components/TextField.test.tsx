import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { TextField } from "./TextField.tsx";

test("renders label and value", () => {
  const { lastFrame } = render(
    <TextField
      label="remote"
      value="origin"
      isActive={false}
      onChange={() => {}}
    />,
  );
  expect(lastFrame()).toContain("remote");
  expect(lastFrame()).toContain("origin");
});

test("typing a character when active calls onChange", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="remote" value="" isActive onChange={onChange} />,
  );
  stdin.write("x");
  expect(onChange).toHaveBeenCalledWith("x");
});

test("active empty field shows a cursor before the placeholder", () => {
  const { lastFrame } = render(
    <TextField
      label="projectDir"
      value=""
      isActive
      placeholder="~/dev/groundcrew"
      onChange={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  expect(frame).toContain("▏");
  expect(frame).toContain("~/dev/groundcrew");
  // The cursor sits at the input origin, before the ghost placeholder.
  expect(frame.indexOf("▏")).toBeLessThan(frame.indexOf("~/dev/groundcrew"));
});

test("inactive field shows no cursor", () => {
  const { lastFrame } = render(
    <TextField
      label="projectDir"
      value=""
      isActive={false}
      placeholder="~/dev/groundcrew"
      onChange={() => {}}
    />,
  );
  expect(lastFrame()).not.toContain("▏");
});

test("backspace removes the last character", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="remote" value="ab" isActive onChange={onChange} />,
  );
  stdin.write("");
  expect(onChange).toHaveBeenCalledWith("a");
});

const LEFT = "\x1b[D";
const RIGHT = "\x1b[C";
const BACKSPACE = "\x7f";

test("left arrow then typing inserts at the caret", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="cmd" value="abcd" isActive onChange={onChange} />,
  );
  // caret starts at end (4); move it back to between "ab" and "cd", then type.
  stdin.write(LEFT);
  stdin.write(LEFT);
  stdin.write("Z");
  expect(onChange).toHaveBeenCalledWith("abZcd");
});

test("right arrow moves the caret back toward the end", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="cmd" value="abcd" isActive onChange={onChange} />,
  );
  stdin.write(LEFT); // caret 4 -> 3
  stdin.write(LEFT); // caret 3 -> 2
  stdin.write(RIGHT); // caret 2 -> 3
  stdin.write("Z");
  expect(onChange).toHaveBeenCalledWith("abcZd");
});

test("backspace deletes the character before the caret", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="cmd" value="abcd" isActive onChange={onChange} />,
  );
  stdin.write(LEFT); // caret between "abc" and "d"
  stdin.write(BACKSPACE); // deletes "c"
  expect(onChange).toHaveBeenCalledWith("abd");
});

test("left arrow does not move past the start", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="cmd" value="ab" isActive onChange={onChange} />,
  );
  stdin.write(LEFT);
  stdin.write(LEFT);
  stdin.write(LEFT); // clamps at 0
  stdin.write("Z");
  expect(onChange).toHaveBeenCalledWith("Zab");
});

test("right arrow does not move past the end", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="cmd" value="ab" isActive onChange={onChange} />,
  );
  stdin.write(RIGHT);
  stdin.write(RIGHT); // already at end; clamps
  stdin.write("Z");
  expect(onChange).toHaveBeenCalledWith("abZ");
});

test("an interior caret does not split the value with a column", async () => {
  // Regression: the caret used to occupy its own column, so moving it into the
  // middle inserted a visible gap (e.g. "flawless-inve ntory"). The interior
  // cursor must highlight the character it sits on, leaving the text contiguous.
  const { lastFrame, stdin } = render(
    <TextField label="name" value="flawless-inventory" isActive onChange={() => {}} />,
  );
  stdin.write(LEFT);
  stdin.write(LEFT);
  stdin.write(LEFT); // caret now inside "inventory"
  // Let the caret blink toggle a few times; the word must stay intact in every frame.
  await new Promise((r) => setTimeout(r, 50));
  expect(lastFrame() ?? "").toContain("flawless-inventory");
});

test("the end caret still renders a visible bar at the value's tail", () => {
  const { lastFrame } = render(
    <TextField label="cmd" value="ab" isActive onChange={() => {}} />,
  );
  // Caret homes to the end on focus; the trailing bar is harmless (no split).
  expect(lastFrame() ?? "").toContain("ab▏");
});

test("renders a yellow ● marker when modified", () => {
  const { lastFrame } = render(
    <TextField
      label="remote"
      value="upstream"
      isActive={false}
      modified
      onChange={() => {}}
    />,
  );
  expect(lastFrame() ?? "").toContain("●");
});

test("does not render ● when not modified", () => {
  const { lastFrame } = render(
    <TextField
      label="remote"
      value="origin"
      isActive={false}
      modified={false}
      onChange={() => {}}
    />,
  );
  expect(lastFrame() ?? "").not.toContain("●");
});
