import type { ReactNode } from "react";
import { Box, Text } from "ink";

export interface ListWindow {
  /** First visible index (inclusive). */
  start: number;
  /** One past the last visible index (exclusive). */
  end: number;
}

/**
 * Pick the slice of `count` rows to show so `cursor` stays visible within at
 * most `maxVisible` rows. Centers the cursor and clamps to the ends, so the
 * first and last rows are reachable. When everything fits (`maxVisible >=
 * count`) it returns the full range — callers then render no scroll affordance.
 */
export function computeWindow(
  count: number,
  cursor: number,
  maxVisible: number,
): ListWindow {
  if (maxVisible <= 0 || maxVisible >= count) return { start: 0, end: count };
  const half = Math.floor(maxVisible / 2);
  const start = Math.max(0, Math.min(cursor - half, count - maxVisible));
  return { start, end: start + maxVisible };
}

interface Props {
  /** Total number of rows (including any trailing "add" row the caller renders). */
  count: number;
  /** Index the viewport must keep visible. */
  cursor: number;
  /** Maximum rows to render at once. */
  maxVisible: number;
  /** Render one row by absolute index. Must return a keyed element. */
  renderRow: (index: number) => ReactNode;
}

/**
 * Render a windowed slice of a list around `cursor`, with `↑ N more` / `↓ N
 * more` markers when rows are hidden above or below. Layout-only: holds no
 * selection state and no input handling — the caller owns row content, keys,
 * cursor movement, and selection styling.
 */
export function ScrollableList({ count, cursor, maxVisible, renderRow }: Props) {
  const { start, end } = computeWindow(count, cursor, maxVisible);
  const rows: ReactNode[] = [];
  for (let index = start; index < end; index += 1) rows.push(renderRow(index));
  return (
    <Box flexDirection="column">
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      {rows}
      {end < count ? <Text dimColor>{`  ↓ ${count - end} more`}</Text> : null}
    </Box>
  );
}

/**
 * Rows a list may render given the terminal height, after reserving space for
 * surrounding chrome (titles, help text, borders, the pinned footer). Floored
 * so a tiny terminal still shows a usable handful.
 */
export function visibleRows(terminalRows: number, reserve: number): number {
  return Math.max(MIN_VISIBLE_ROWS, terminalRows - reserve);
}

const MIN_VISIBLE_ROWS = 4;
