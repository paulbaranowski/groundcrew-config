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

  const shown = value.length > 0 ? value : (placeholder ?? "");
  const dim = value.length === 0;
  return (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
        {label}{" "}
      </Text>
      <Text dimColor={dim}>
        {shown}
        {isActive ? "▏" : ""}
      </Text>
    </Box>
  );
}
