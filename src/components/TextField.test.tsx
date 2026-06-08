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

test("backspace removes the last character", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <TextField label="remote" value="ab" isActive onChange={onChange} />,
  );
  stdin.write("");
  expect(onChange).toHaveBeenCalledWith("a");
});
