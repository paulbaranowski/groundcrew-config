import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

// The value sits on its own row, indented by this many cols under the label.
// Visually nests wrapped lines so the eye reads them as belonging to the field
// above without having to track a hanging indent that varies with label length.
const VALUE_INDENT = 4;

interface Props {
  label: string;
  value: string;
  isActive: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
  /**
   * Inert mode: the field can still be focused (so the cursor lands on it and
   * the reason is visible) but keystrokes are ignored. Used for mutually
   * exclusive fields — see `RepoSubForm`. Implies an empty value.
   */
  disabled?: boolean;
  /** Shown in place of the placeholder while `disabled`. */
  disabledHint?: string;
  /** True when the current value differs from its last-saved baseline. */
  modified?: boolean;
}

// Controlled single-line input with a static caret. Supports an inert
// `disabled` mode (focusable but ignores keystrokes) for mutually-exclusive
// fields. Renders as two rows — label on row 1, value (which wraps naturally)
// on row 2 — so a long value never mangles the label's position.
// The caret is intentionally non-blinking: a 530ms re-render loop kept iTerm2
// (and likely other terminals) from holding an active text selection — every
// blink wrote the caret cell, which invalidates the selection. Static caret =
// native click-and-drag-to-copy survives idle.
export function TextField({
  label,
  value,
  isActive,
  onChange,
  placeholder,
  disabled = false,
  disabledHint,
  modified = false,
}: Props) {
  // Caret position (index into `value`, 0..value.length). Mirrored in a ref so a
  // burst of keypresses delivered in one render — each `useInput` call shares the
  // same stale `caret` closure until React re-renders — still moves and edits
  // from the latest position (same reason `ListField` keeps `cursorRef`). The
  // handler MUST read `caretRef.current`, never the render-time `caret`.
  const [caret, setCaret] = useState(value.length);
  const caretRef = useRef(value.length);
  function moveCaret(next: number): void {
    caretRef.current = next;
    setCaret(next);
  }
  // Re-home the caret to the end whenever the field (re)gains focus, so editing
  // an existing value starts at a sensible place. Deliberately keyed on focus
  // only (not `value`): re-homing on every keystroke would fight interior edits.
  useEffect(() => {
    if (isActive && !disabled) moveCaret(value.length);
  }, [isActive, disabled]);

  useInput(
    (input, key) => {
      const pos = Math.min(caretRef.current, value.length);
      if (key.leftArrow) {
        moveCaret(Math.max(0, pos - 1));
        return;
      }
      if (key.rightArrow) {
        moveCaret(Math.min(value.length, pos + 1));
        return;
      }
      if (key.backspace || key.delete) {
        // Backspace removes the character before the caret.
        if (pos === 0) return;
        onChange(value.slice(0, pos - 1) + value.slice(pos));
        moveCaret(pos - 1);
        return;
      }
      if (key.return || key.upArrow || key.downArrow || key.escape || key.tab)
        return;
      if (input) {
        onChange(value.slice(0, pos) + input + value.slice(pos));
        moveCaret(pos + input.length);
      }
    },
    { isActive: isActive && !disabled },
  );

  const labelRow = (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
        {label}{" "}
      </Text>
      {modified ? <Text color="yellow">●</Text> : null}
    </Box>
  );

  if (disabled) {
    return (
      <Box flexDirection="column">
        {labelRow}
        <Box paddingLeft={VALUE_INDENT}>
          <Text dimColor>{disabledHint ?? "(disabled)"}</Text>
        </Box>
      </Box>
    );
  }

  const hasValue = value.length > 0;
  const pos = Math.min(caret, value.length);
  // The caret has two renderings depending on where it sits:
  //   • At the end of the value (or on an empty field) there is no character to
  //     mark, so draw a thin bar in its own column. A trailing bar is harmless —
  //     it never splits the text.
  //   • In the *interior*, drawing a bar would insert a column and visibly split
  //     the word (e.g. "flawless-inve▏ntory"). Instead, highlight the character
  //     the caret sits on with inverse video — a block cursor that occupies no
  //     extra column, so the text stays contiguous.
  const endBar = isActive ? <Text color="cyan">▏</Text> : null;
  const atEnd = pos >= value.length;
  return (
    <Box flexDirection="column">
      {labelRow}
      <Box paddingLeft={VALUE_INDENT}>
        {!hasValue ? (
          <Text>
            {endBar}
            <Text dimColor>{placeholder ?? ""}</Text>
          </Text>
        ) : atEnd ? (
          <Text>
            {value}
            {endBar}
          </Text>
        ) : (
          <Text>
            {value.slice(0, pos)}
            <Text inverse={isActive}>{value[pos]}</Text>
            {value.slice(pos + 1)}
          </Text>
        )}
      </Box>
    </Box>
  );
}
