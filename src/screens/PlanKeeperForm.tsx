import { Box, Text, useInput } from "ink";
import {
  isPlanKeeperEnabled,
  planKeeperCommands,
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
  const commands = planKeeperCommands(draft);
  // Pad the integration-command names so their commands line up in a column.
  const labelWidth = (commands ?? []).reduce(
    (max, [name]) => Math.max(max, name.length),
    0,
  );

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
      {commands && commands.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text>Commands:</Text>
          {commands.map(([name, command]) => (
            <Text key={name} dimColor>
              {"  "}
              {name.padEnd(labelWidth)} {command}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
