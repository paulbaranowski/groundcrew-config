import { Box, Text, useInput } from "ink";
import {
  isPlanKeeperEnabled,
  setPlanKeeperEnabled,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

export function PlanKeeperForm({ draft, onChange, onBack }: Props) {
  const enabled = isPlanKeeperEnabled(draft);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === " ") onChange(setPlanKeeperEnabled(draft, !enabled));
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>PlanKeeper</Text>
      <Box marginTop={1}>
        <Text>
          plan-keeper source:{" "}
          <Text color={enabled ? "green" : "yellow"}>
            {enabled ? "enabled" : "disabled"}
          </Text>
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Feeds plans from ~/plans into groundcrew as tickets. Space toggles.
        </Text>
        <Text dimColor>
          Install: brew install paulbaranowski/tap/plan-keeper
        </Text>
      </Box>
    </Box>
  );
}
