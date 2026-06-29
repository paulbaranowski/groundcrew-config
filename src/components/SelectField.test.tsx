import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { SelectField } from "./SelectField.tsx";

test("shows current option marked", () => {
  const { lastFrame } = render(
    <SelectField
      label="runner"
      value="auto"
      options={["auto", "sdx", "none"]}
      isActive
      onChange={() => {}}
    />,
  );
  expect(lastFrame()).toContain("auto");
});

test("right arrow advances to next option", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <SelectField
      label="runner"
      value="auto"
      options={["auto", "sdx", "none"]}
      isActive
      onChange={onChange}
    />,
  );
  stdin.write("[C"); // right arrow
  expect(onChange).toHaveBeenCalledWith("sdx");
});

test("empty options: arrow keys do not emit a value", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <SelectField
      label="runner"
      value=""
      options={[]}
      isActive
      onChange={onChange}
    />,
  );
  stdin.write("\u001B[C"); // right arrow
  expect(onChange).not.toHaveBeenCalled();
});

test("left arrow wraps to the last option", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <SelectField
      label="runner"
      value="auto"
      options={["auto", "sdx", "none"]}
      isActive
      onChange={onChange}
    />,
  );
  stdin.write("[D"); // left arrow
  expect(onChange).toHaveBeenCalledWith("none");
});

test("renders a yellow ● when modified", () => {
  const { lastFrame } = render(
    <SelectField
      label="runner"
      value="sdx"
      options={["auto", "sdx", "none"]}
      isActive={false}
      modified
      onChange={() => {}}
    />,
  );
  expect(lastFrame() ?? "").toContain("●");
});
