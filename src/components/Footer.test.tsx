import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { Footer } from "./Footer.tsx";

test("shows unsaved marker and issue count", () => {
  const { lastFrame } = render(
    <Footer dirty issues={2} hint="s save · q quit" />,
  );
  expect(lastFrame()).toContain("unsaved");
  expect(lastFrame()).toContain("2 issues");
  expect(lastFrame()).toContain("s save");
});

test("shows all-valid state", () => {
  const { lastFrame } = render(
    <Footer dirty={false} issues={0} hint="enter edit" />,
  );
  expect(lastFrame()).toContain("✓");
});

test("shows invalid state when not valid even with no mapped section", () => {
  const { lastFrame } = render(
    <Footer dirty={false} issues={0} valid={false} hint="enter edit" />,
  );
  expect(lastFrame()).not.toContain("✓");
  expect(lastFrame()).toContain("invalid");
});
