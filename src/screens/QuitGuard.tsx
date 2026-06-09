import { Box, Text, useInput } from "ink";

interface Props {
  onSaveQuit: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function QuitGuard({ onSaveQuit, onDiscard, onCancel }: Props) {
  useInput((input, key) => {
    if (input === "s") onSaveQuit();
    if (input === "d") onDiscard();
    if (key.escape) onCancel();
  });
  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Text bold>Unsaved changes</Text>
      <Box marginTop={1}>
        <Text>Save before quitting?</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[s] Save &amp; quit [d] Discard [esc] Cancel</Text>
      </Box>
    </Box>
  );
}
