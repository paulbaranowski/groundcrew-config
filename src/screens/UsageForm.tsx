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
          Usage tracking lets groundcrew watch your AI subscription's usage so it
          won't launch agents when you're near your limits. Disabling opts every
          enabled agent out. Space toggles.
        </Text>
        <Text dimColor>
          Needs the codexbar menu-bar app on Mac (groundcrew reads usage via its
          codexbar CLI). Install: brew install --cask steipete/tap/codexbar
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
