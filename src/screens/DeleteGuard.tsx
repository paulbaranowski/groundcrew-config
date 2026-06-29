import { Box, Text, useInput } from "ink";

interface Props {
  /** Name of the entry being deleted, shown in the prompt. */
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown before deleting a repo entry — the destructive-action
 * analogue of `SaveGuard`/`QuitGuard`. `y` (or enter) confirms the delete, esc
 * cancels. Added at the `RepositoriesForm` level rather than in the shared
 * `ListField`, so other lists keep their immediate-delete behavior.
 */
export function DeleteGuard({ name, onConfirm, onCancel }: Props) {
  useInput((input, key) => {
    if (input === "y" || key.return) onConfirm();
    if (key.escape) onCancel();
  });
  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Text bold>Delete {name}?</Text>
      <Box marginTop={1}>
        <Text dimColor>[y] Delete [esc] Cancel</Text>
      </Box>
    </Box>
  );
}
