import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useFullscreen } from "../hooks/useFullscreen.ts";
import { ScrollableList, visibleRows } from "./ScrollableList.tsx";

export interface ListItem {
  label: string;
  note: string | undefined;
  error: string | undefined;
  /** True when the item differs from its last-saved baseline. */
  modified?: boolean;
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

/**
 * A focusable action row rendered after the trailing add row (e.g. "+ discover
 * repositories…"). Enter on it fires `onPress`. Unlike an ItemAction it is not
 * tied to a real item, so item shortcuts (`c`/`d`) never fire on it.
 */
export interface ExtraAction {
  label: string;
  onPress: () => void;
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
  /** Extra focusable action rows rendered after the add row. */
  extraActions?: ExtraAction[];
}

// An editable list of items with a moving cursor: ↑/↓ select, enter activates a
// row (the trailing "add" row, or one of the extra action rows after it), `d`
// deletes, and optional single-key itemActions fire on the focused item.
// Windowed by ScrollableList.
export function ListField({
  items,
  isActive,
  onActivate,
  onDelete,
  addLabel = "+ add repository…",
  itemActions,
  extraActions = [],
}: Props) {
  const [cursor, setCursor] = useState(0);
  // Mirror the cursor in a ref so a burst of keypresses delivered in one render
  // (each useInput call shares a stale `cursor` closure until React re-renders)
  // still reads and advances from the latest position. The useInput handler
  // below MUST read `cursorRef.current`, never the render-time `cursor` state:
  // every keystroke in a single tick sees the same stale closure, so a fast
  // ↑/↓-then-enter would act on the pre-burst index. Do not "simplify" the ref
  // away in favor of `cursor` — it reintroduces that stale-closure bug.
  const cursorRef = useRef(0);
  const { rows: terminalRows } = useFullscreen();
  // Rows: every item, the add row, then each extra action row.
  const rows = items.length + 1 + extraActions.length;
  const maxVisible = visibleRows(terminalRows, LIST_CHROME_ROWS);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput(
    (input, key) => {
      if (key.downArrow) moveCursor(Math.min(rows - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) {
        // Rows past the add row are extra actions; everything up to and
        // including the add row routes through onActivate.
        if (cursorRef.current > items.length) {
          extraActions[cursorRef.current - items.length - 1]?.onPress();
        } else {
          onActivate(cursorRef.current);
        }
      }
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

  // Render one row by absolute index: items, then the add row (=== items.length),
  // then the extra action rows. Windowed by ScrollableList so long lists never
  // overflow.
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
    if (index > items.length) {
      const action = extraActions[index - items.length - 1]!;
      return (
        <Text
          key={`action-${index}`}
          color={isActive && cursor === index ? "cyan" : undefined}
          dimColor
        >
          {isActive && cursor === index ? "▸ " : "  "}
          {action.label}
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
        {item.modified ? <Text color="yellow"> ●</Text> : null}
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
