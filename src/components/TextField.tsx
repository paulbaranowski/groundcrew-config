import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";

const CARET_BLINK_MS = 530;

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
}

export function TextField({
  label,
  value,
  isActive,
  onChange,
  placeholder,
  disabled = false,
  disabledHint,
}: Props) {
  useInput(
    (input, key) => {
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.return || key.upArrow || key.downArrow || key.escape || key.tab)
        return;
      if (input) onChange(value + input);
    },
    { isActive: isActive && !disabled },
  );

  // Blink a bright caret at the input origin so an empty active field reads as
  // "type here". The interval is unref'd: it fires while Ink keeps the app alive
  // but never blocks process/test exit on its own, and is cleared on unmount or
  // when the field deactivates.
  const [caretOn, setCaretOn] = useState(true);
  useEffect(() => {
    if (!isActive || disabled) {
      setCaretOn(true);
      return;
    }
    const timer = setInterval(() => setCaretOn((on) => !on), CARET_BLINK_MS);
    timer.unref?.();
    return () => clearInterval(timer);
  }, [isActive, disabled]);

  if (disabled) {
    return (
      <Box>
        <Text color={isActive ? "cyan" : undefined}>
          {isActive ? "› " : "  "}
          {label}{" "}
        </Text>
        <Text dimColor>{disabledHint ?? "(disabled)"}</Text>
      </Box>
    );
  }

  const hasValue = value.length > 0;
  // A space when the caret is "off" keeps the text from shifting as it blinks.
  const caret = isActive ? (
    <Text color="cyan">{caretOn ? "▏" : " "}</Text>
  ) : null;
  return (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
        {label}{" "}
      </Text>
      {hasValue ? (
        <Text>
          {value}
          {caret}
        </Text>
      ) : (
        <Text>
          {caret}
          <Text dimColor>{placeholder ?? ""}</Text>
        </Text>
      )}
    </Box>
  );
}
