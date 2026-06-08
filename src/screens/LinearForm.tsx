import { Box, Text, useInput } from "ink";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

function isDisabled(draft: ConfigDraft): boolean {
  return (draft.sources ?? []).some(
    (s) => s.kind === "linear" && s.enabled === false,
  );
}

export function LinearForm({ draft, onChange, onBack }: Props) {
  const disabled = isDisabled(draft);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === " ") {
      const others = (draft.sources ?? []).filter(
        (s) => !(s.kind === "linear" && s.enabled === false),
      );
      const sources = disabled
        ? others
        : [...others, { kind: "linear", enabled: false } as const];
      onChange({ ...draft, sources });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Linear (built-in)</Text>
      <Box marginTop={1}>
        <Text>
          Built-in Linear source:{" "}
          <Text color={disabled ? "yellow" : "green"}>
            {disabled ? "disabled" : "enabled"}
          </Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Space toggles. Disable for shell-only setups with no Linear API key.
          Status-name overrides live in Ticket Sources.
        </Text>
      </Box>
    </Box>
  );
}
