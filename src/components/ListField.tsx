import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useFullscreen } from "../hooks/useFullscreen.ts";
import { ScrollableList, visibleRows } from "./ScrollableList.tsx";

export interface ListItem {
  label: string;
  note: string | undefined;
  error: string | undefined;
}

/**
 * A single-key shortcut on the focused row (e.g. `c` to duplicate). Fired only
 * when the cursor is on a real item, never the trailing add row. Built-in keys
 * (`↑/↓/enter/d`) take precedence: a colliding itemAction key is ignored rather
 * than double-firing alongside the built-in handler.
 */
export interface ItemAction {
  key: string;
  onPress: (index: number) => void;
}

// Rows consumed by surrounding chrome when a ListField is on screen: the form's
// outer border + title + help block, this field's own border, and the pinned
// footer. Conservative — overshooting just scrolls a row or two earlier.
const LIST_CHROME_ROWS = 11;
interface Props {
  items: ListItem[];
  isActive: boolean;
  onActivate: (index: number) => void; // index === items.length means "add"
  onDelete: (index: number) => void;
  /** Label for the trailing add row. */
  addLabel?: string;
  /** Single-key shortcuts fired only when the cursor is on a real item. */
  itemActions?: ItemAction[];
}

export function ListField({
  items,
  isActive,
  onActivate,
  onDelete,
  addLabel = "+ add repository…",
  itemActions,
}: Props) {
  const [cursor, setCursor] = useState(0);
  // Mirror the cursor in a ref so a burst of keypresses delivered in one render
  // (each useInput call shares a stale `cursor` closure until React re-renders)
  // still reads and advances from the latest position.
  const cursorRef = useRef(0);
  const { rows: terminalRows } = useFullscreen();
  const rows = items.length + 1; // +1 for the add row
  const maxVisible = visibleRows(terminalRows, LIST_CHROME_ROWS);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput(
    (input, key) => {
      if (key.downArrow) moveCursor(Math.min(rows - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) onActivate(cursorRef.current);
      if (input === "d" && cursorRef.current < items.length) {
        // Built-in delete wins: short-circuit so a `{key:"d"}` itemAction can't
        // also fire for the same keystroke.
        onDelete(cursorRef.current);
        return;
      }
      // Item actions act on the focused real item only — never the add row.
      if (cursorRef.current < items.length) {
        const action = itemActions?.find((a) => a.key === input);
        if (action) action.onPress(cursorRef.current);
      }
    },
    { isActive },
  );

  // Render one row by absolute index; the final index (=== items.length) is the
  // trailing "add" row. Windowed by ScrollableList so long lists never overflow.
  function renderRow(index: number) {
    if (index === items.length) {
      return (
        <Text
          key="add"
          color={isActive && cursor === items.length ? "cyan" : undefined}
          dimColor
        >
          {isActive && cursor === items.length ? "▸ " : "  "}
          {addLabel}
        </Text>
      );
    }
    const item = items[index]!;
    return (
      <Box key={index}>
        <Text color={isActive && cursor === index ? "cyan" : undefined}>
          {isActive && cursor === index ? "▸ " : "  "}
          {item.label}
        </Text>
        {item.note ? <Text dimColor> {item.note}</Text> : null}
        {item.error ? <Text color="yellow"> ⚠ {item.error}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <ScrollableList
        count={rows}
        cursor={cursor}
        maxVisible={maxVisible}
        renderRow={renderRow}
      />
    </Box>
  );
}
