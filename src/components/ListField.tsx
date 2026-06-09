import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

export interface ListItem {
  label: string;
  note: string | undefined;
  error: string | undefined;
}
interface Props {
  items: ListItem[];
  isActive: boolean;
  onActivate: (index: number) => void; // index === items.length means "add"
  onDelete: (index: number) => void;
}

export function ListField({ items, isActive, onActivate, onDelete }: Props) {
  const [cursor, setCursor] = useState(0);
  // Mirror the cursor in a ref so a burst of keypresses delivered in one render
  // (each useInput call shares a stale `cursor` closure until React re-renders)
  // still reads and advances from the latest position.
  const cursorRef = useRef(0);
  const rows = items.length + 1; // +1 for the add row

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput(
    (input, key) => {
      if (key.downArrow) moveCursor(Math.min(rows - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) onActivate(cursorRef.current);
      if (input === "d" && cursorRef.current < items.length)
        onDelete(cursorRef.current);
    },
    { isActive },
  );

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {items.map((item, index) => (
        <Box key={index}>
          <Text color={isActive && cursor === index ? "cyan" : undefined}>
            {isActive && cursor === index ? "▸ " : "  "}
            {item.label}
          </Text>
          {item.note ? <Text dimColor> {item.note}</Text> : null}
          {item.error ? <Text color="yellow"> ⚠ {item.error}</Text> : null}
        </Box>
      ))}
      <Text
        color={isActive && cursor === items.length ? "cyan" : undefined}
        dimColor
      >
        {isActive && cursor === items.length ? "▸ " : "  "}+ add repository…
      </Text>
    </Box>
  );
}
