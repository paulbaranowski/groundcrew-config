import { Box, Text, useInput } from "ink";

interface Props {
  label: string;
  value: string;
  isActive: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
}

export function TextField({
  label,
  value,
  isActive,
  onChange,
  placeholder,
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
    { isActive },
  );

  const hasValue = value.length > 0;
  // A bright caret marks the input origin so an empty active field reads as
  // "type here": caret then dim placeholder, rather than a dim caret trailing
  // the ghost text (which looks like part of the hint).
  const caret = isActive ? <Text color="cyan">▏</Text> : null;
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
