import { Box, Text, useInput } from "ink";

interface Props {
  onApply: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  /**
   * Noun for the prompt (e.g. "repository", "shell source") — slotted into
   * "Pending {label} edits". Required because no generic default reads
   * naturally in that template; pick the entry kind being edited.
   */
  label: string;
}

/**
 * Confirmation shown when a sub-editor is left (esc) with pending edits — the
 * per-entry analogue of `QuitGuard`. Apply commits the buffered entry into the
 * in-memory draft (top-level Save is the only thing that writes to disk),
 * Discard drops the buffer, esc keeps editing. Only rendered when the buffer is
 * dirty (see `useEditGuard`), so an untouched entry still exits on a single esc.
 *
 * The verb is deliberately "Apply" not "Save": these guards only commit the
 * buffered edit into the draft. The word "save" is reserved for the top-level
 * write-to-disk action (see `QuitGuard`) so users can tell the two apart.
 */
export function SaveGuard({ onApply, onDiscard, onCancel, label }: Props) {
  useInput((input, key) => {
    if (input === "a") onApply();
    if (input === "d") onDiscard();
    if (key.escape) onCancel();
  });
  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Text bold>Pending {label} edits</Text>
      <Box marginTop={1}>
        <Text>Apply these edits to the draft?</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[a] Apply [d] Discard [esc] Keep editing</Text>
      </Box>
    </Box>
  );
}
