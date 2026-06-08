import { Box, Text } from "ink";

interface Props {
  dirty: boolean;
  issues: number;
  hint: string;
  /** Overall validity. Defaults true; false renders an invalid marker even when
   * no specific section could be blamed (issues === 0). */
  valid?: boolean;
  /** Whether at least one validation has completed. Defaults true; while false
   * the validity indicator is neutral instead of asserting "valid". */
  checked?: boolean;
}

export function Footer({
  dirty,
  issues,
  hint,
  valid = true,
  checked = true,
}: Props) {
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
        ) : !checked ? (
          <Text dimColor>… checking</Text>
        ) : valid ? (
          <Text color="green">✓ valid</Text>
        ) : (
          <Text color="yellow">⚠ invalid</Text>
        )}
        {dirty ? <Text color="yellow"> · ● unsaved</Text> : null}
      </Text>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
