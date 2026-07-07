import { useState } from "react";
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
  // Settle briefly so the keystrokes apply; the word must stay intact after focus
  // settles (the inverse-video caret occupies no extra column).
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

test("renders the label on its own row above the value", () => {
  // The whole point of the two-row layout: the label sits alone on row 1 so a
  // long value below it can wrap freely without ever pushing the label aside.
  const { lastFrame } = render(
    <TextField
      label="provision.create"
      value="graft new ${branch} catalog/admin"
      isActive
      onChange={() => {}}
    />,
  );
  const lines = (lastFrame() ?? "").split("\n");
  const labelIdx = lines.findIndex((l) => l.includes("provision.create"));
  const valueIdx = lines.findIndex((l) => l.includes("graft new"));
  expect(labelIdx).toBeGreaterThanOrEqual(0);
  expect(valueIdx).toBeGreaterThan(labelIdx);
  // The label row carries only the label (no value text leaked onto it).
  expect(lines[labelIdx]).not.toContain("graft new");
});

test("the value row is indented under the label", () => {
  const { lastFrame } = render(
    <TextField label="cmd" value="hello" isActive onChange={() => {}} />,
  );
  const lines = (lastFrame() ?? "").split("\n");
  const valueLine = lines.find((l) => l.includes("hello")) ?? "";
  // The 4-col indent on the value row sets it visually under the label,
  // distinct from the label's `›`/`  ` 2-col prefix.
  expect(valueLine).toMatch(/^ {4}/);
});

// Controlled harness wired like the real app: a single useState, plain (non-
// functional) updates. The key-repeat regressions below only reproduce against
// live state, because they depend on how successive edits compound.
function Stateful({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <TextField label="cmd" value={value} isActive onChange={setValue} />;
}

test("a held backspace fused into one stdin chunk deletes one char per repeat", async () => {
  // Terminal key-repeat can deliver several DEL bytes in a single read. Ink
  // splits chunks only at escape sequences, so all three arrive as ONE input
  // event with key.delete unset. Each byte must still act as a backspace.
  const { stdin, lastFrame } = render(<Stateful initial="hello" />);
  stdin.write(BACKSPACE + BACKSPACE + BACKSPACE);
  await vi.waitFor(() => {
    const frame = lastFrame() ?? "";
    expect(frame).toContain("he▏"); // "he" left, caret at the end
    expect(frame).not.toContain("hel");
  });
});

test("control bytes in a fused chunk are never inserted into the value", async () => {
  const { stdin, lastFrame } = render(<Stateful initial="" />);
  // One fused event: type "a", type "b", backspace. The DEL byte must edit,
  // not land in the value as a literal control character.
  stdin.write("ab" + BACKSPACE);
  await vi.waitFor(() => {
    const frame = lastFrame() ?? "";
    expect(frame).toContain("a▏");
    expect(frame).not.toContain("ab");
    expect(frame).not.toContain("\x7f");
  });
});

test("edits split across several same-tick events compound instead of clobbering", async () => {
  // One chunk, but the interior escape sequence makes Ink split it into three
  // events (backspace, left, backspace) dispatched in the same tick. Each
  // handler call must see the value produced by the previous one, not the
  // stale render-time prop: "hello" -> "hell" -> caret left -> "hel".
  const { stdin, lastFrame } = render(<Stateful initial="hello" />);
  stdin.write(BACKSPACE + LEFT + BACKSPACE);
  await vi.waitFor(() => {
    const frame = lastFrame() ?? "";
    expect(frame).toContain("hel");
    expect(frame).not.toContain("hell");
    expect(frame).not.toContain("helo");
  });
});

test("a disabled field still shows its hint on the value row", () => {
  const { lastFrame } = render(
    <TextField
      label="projectDirOverride"
      value=""
      isActive={false}
      disabled
      disabledHint="(disabled — clear provision to use)"
      onChange={() => {}}
    />,
  );
  const lines = (lastFrame() ?? "").split("\n");
  const labelIdx = lines.findIndex((l) => l.includes("projectDirOverride"));
  const hintIdx = lines.findIndex((l) => l.includes("clear provision"));
  expect(labelIdx).toBeGreaterThanOrEqual(0);
  expect(hintIdx).toBeGreaterThan(labelIdx);
});
