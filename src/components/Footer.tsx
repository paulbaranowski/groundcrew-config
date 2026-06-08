import { Box, Text } from "ink";

interface Props {
  dirty: boolean;
  issues: number;
  hint: string;
}

export function Footer({ dirty, issues, hint }: Props) {
  return (
    <Box
      justifyContent="space-between"
      borderStyle="single"
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text>
        {issues > 0 ? (
          <Text color="yellow">
            ⚠ {issues} issue{issues === 1 ? "" : "s"}
          </Text>
        ) : (
          <Text color="green">✓ valid</Text>
        )}
        {dirty ? <Text color="yellow"> · ● unsaved</Text> : null}
      </Text>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
