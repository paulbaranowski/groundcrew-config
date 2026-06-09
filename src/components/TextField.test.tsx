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
