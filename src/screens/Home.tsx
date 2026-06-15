import { useRef } from "react";
import { Box, Text, useInput } from "ink";
import {
  SECTION_LABEL,
  SECTION_ORDER,
  sectionSummary,
  type SectionId,
} from "../domain/sections.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { ScrollableList, visibleRows } from "../components/ScrollableList.tsx";
import { useFullscreen } from "../hooks/useFullscreen.ts";

// Rows reserved above/below the section list: the crew-config header, the intro
// blurb, spacing, and the pinned footer.
const HOME_CHROME_ROWS = 9;

interface Props {
  draft: ConfigDraft;
  issues: Set<SectionId>;
  /** Sections whose draft slice differs from baseline (unsaved edits). */
  modified: Set<SectionId>;
  // Selected-row index, owned by App so it survives navigating into a section
  // and back (Home unmounts while a section is open).
  cursor: number;
  onCursorChange: (next: number) => void;
  onOpen: (id: SectionId) => void;
}

export function Home({
  draft,
  issues,
  modified,
  cursor,
  onCursorChange,
  onOpen,
}: Props) {
  // Mirror the cursor in a ref so an enter that lands in the same input batch as
  // a preceding arrow key (before App re-renders) opens the latest row. The
  // useInput handler below MUST read `cursorRef.current`, never the render-time
  // `cursor` prop: a burst of keystrokes in one tick all share the same stale
  // closure, so reading `cursor` would open the pre-burst row. Do not "simplify"
  // the ref away.
  //
  // The per-render re-sync below is also load-bearing: `cursor` is owned by App
  // (so it survives navigating into a section and back), and a parent can change
  // it between renders. Re-syncing `cursorRef.current = cursor` every render
  // keeps an externally-changed cursor authoritative — drop it and external
  // cursor updates are silently ignored.
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const { rows: terminalRows } = useFullscreen();
  const maxVisible = visibleRows(terminalRows, HOME_CHROME_ROWS);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    onCursorChange(next);
  }

  useInput((_input, key) => {
    if (key.downArrow)
      moveCursor(Math.min(SECTION_ORDER.length - 1, cursorRef.current + 1));
    if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
    if (key.return) {
      const id = SECTION_ORDER[cursorRef.current];
      if (id) onOpen(id);
    }
  });

  function renderRow(index: number) {
    const id = SECTION_ORDER[index]!;
    const bad = issues.has(id);
    const edited = modified.has(id);
    return (
      <Box key={id}>
        <Text color={cursor === index ? "cyan" : undefined}>
          {cursor === index ? "▸ " : "  "}
        </Text>
        <Box width={16}>
          <Text color={cursor === index ? "cyan" : undefined}>
            {SECTION_LABEL[id]}
          </Text>
        </Box>
        <Text color={bad ? "yellow" : "green"}>{bad ? "⚠" : "✓"} </Text>
        <Text dimColor>{sectionSummary(id, draft)}</Text>
        {edited ? <Text color="yellow"> (edited)</Text> : null}
      </Box>
    );
  }

  return (
    <ScrollableList
      count={SECTION_ORDER.length}
      cursor={cursor}
      maxVisible={maxVisible}
      renderRow={renderRow}
    />
  );
}
