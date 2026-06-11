import { render } from "ink-testing-library";
import { Text } from "ink";
import { expect, test } from "vitest";
import {
  computeWindow,
  ScrollableList,
  visibleRows,
} from "./ScrollableList.tsx";

test("returns the full range when everything fits", () => {
  expect(computeWindow(5, 0, 10)).toEqual({ start: 0, end: 5 });
  expect(computeWindow(5, 4, 5)).toEqual({ start: 0, end: 5 });
});

test("centers the cursor when scrolled into the middle", () => {
  expect(computeWindow(100, 50, 10)).toEqual({ start: 45, end: 55 });
});

test("clamps to the top and bottom edges", () => {
  expect(computeWindow(100, 0, 10)).toEqual({ start: 0, end: 10 });
  expect(computeWindow(100, 99, 10)).toEqual({ start: 90, end: 100 });
});

test("degenerate maxVisible falls back to the full range", () => {
  expect(computeWindow(5, 2, 0)).toEqual({ start: 0, end: 5 });
});

test("renders no markers when all rows fit", () => {
  const { lastFrame } = render(
    <ScrollableList
      count={3}
      cursor={0}
      maxVisible={10}
      renderRow={(i) => <Text key={i}>row{i}</Text>}
    />,
  );
  expect(lastFrame()).toContain("row0");
  expect(lastFrame()).toContain("row2");
  expect(lastFrame()).not.toContain("more");
});

test("shows above/below markers and only the windowed rows", () => {
  const { lastFrame } = render(
    <ScrollableList
      count={10}
      cursor={5}
      maxVisible={4}
      renderRow={(i) => <Text key={i}>row{i}</Text>}
    />,
  );
  const frame = lastFrame() ?? "";
  expect(frame).toContain("↑ 3 more");
  expect(frame).toContain("↓ 3 more");
  expect(frame).toContain("row3");
  expect(frame).toContain("row6");
  expect(frame).not.toContain("row0");
  expect(frame).not.toContain("row9");
});

test("visibleRows reserves chrome and floors at a usable minimum", () => {
  expect(visibleRows(40, 10)).toBe(30);
  expect(visibleRows(12, 10)).toBe(4); // floored, not 2
});
