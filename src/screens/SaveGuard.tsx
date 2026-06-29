import { Box, Text, useInput } from "ink";

interface Props {
  onApply: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown when a sub-editor is left (esc) with pending edits — the
 * per-entry analogue of `QuitGuard`. Apply commits the buffered entry into the
 * in-memory draft; Discard drops the buffer; esc keeps editing. Only rendered
 * when the buffer is dirty (see `useEditGuard`), so an untouched entry still
 * exits on a single esc.
 *
 * The prompt names the disk distinction inline ("will not save to disk") so
 * users can tell this guard apart from the top-level QuitGuard, which is the
 * only thing that writes `crew.config.json`.
 */
export function SaveGuard({ onApply, onDiscard, onCancel }: Props) {
  useInput((input, key) => {
    if (input === "a") onApply();
    if (input === "d") onDiscard();
    if (key.escape) onCancel();
  });
  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Text>Save these edits to current draft config? (will not save to disk)</Text>
      <Box marginTop={1}>
        <Text dimColor>[a] Apply [d] Discard [esc] Keep editing</Text>
      </Box>
    </Box>
  );
}
