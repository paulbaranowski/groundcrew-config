import { Box, Text, useInput } from "ink";
import { isUsageDisabled, setUsageDisabled } from "../domain/usage.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

export function UsageForm({ draft, onChange, onBack }: Props) {
  const disabled = isUsageDisabled(draft.agents);
  const hasAgents = Object.keys(draft.agents?.definitions ?? {}).length > 0;

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === " " && hasAgents) {
      onChange({ ...draft, agents: setUsageDisabled(draft.agents, !disabled) });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Usage</Text>
      <Box marginTop={1}>
        <Text>
          Usage tracking:{" "}
          <Text color={disabled ? "yellow" : "green"}>
            {disabled ? "disabled" : "enabled"}
          </Text>
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Disabling sets usage:&#123; disabled: true &#125; on every enabled agent
          (groundcrew's only opt-out from session-usage / codexbar gating). Space
          toggles.
        </Text>
        {hasAgents ? null : (
          <Text dimColor>
            (no enabled agents to gate — add one under Agents)
          </Text>
        )}
      </Box>
    </Box>
  );
}
