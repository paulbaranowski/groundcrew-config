import { Box, Text, useInput } from "ink";

interface Props {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  /** Noun for the prompt, e.g. "repository". Defaults to "changes". */
  label?: string;
}

/**
 * Confirmation shown when a sub-editor is left (esc) with unsaved edits — the
 * per-entry analogue of `QuitGuard`. Save commits the buffered entry, Discard
 * drops it, esc keeps editing. Only rendered when the buffer is dirty (see
 * `useEditGuard`), so an untouched entry still exits on a single esc.
 */
export function SaveGuard({ onSave, onDiscard, onCancel, label = "changes" }: Props) {
  useInput((input, key) => {
    if (input === "s") onSave();
    if (input === "d") onDiscard();
    if (key.escape) onCancel();
  });
  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Text bold>Unsaved {label}</Text>
      <Box marginTop={1}>
        <Text>Save before leaving?</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[s] Save [d] Discard [esc] Keep editing</Text>
      </Box>
    </Box>
  );
}
