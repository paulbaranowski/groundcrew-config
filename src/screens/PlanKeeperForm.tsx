import { Box, Text, useInput } from "ink";
import {
  isPlanKeeperEnabled,
  planKeeperCommands,
  planKeeperSandboxPaths,
  setPlanKeeperEnabled,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// Section editor for the PlanKeeper task source (a `kind:"shell"` preset feeding
// saved ~/plans in as tasks): an enable toggle that shows its preset commands.
// Follows the screen contract — see SectionForm.
export function PlanKeeperForm({ draft, baseline, onChange, onBack }: Props) {
  const enabled = isPlanKeeperEnabled(draft);
  const enableModified =
    isPlanKeeperEnabled(draft) !== isPlanKeeperEnabled(baseline);
  const commands = planKeeperCommands(draft);
  const sandboxPaths = planKeeperSandboxPaths(draft);
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
          {enableModified ? <Text color="yellow"> ●</Text> : null}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Feeds saved plans from ~/plans in as tasks (via the plan-keeper tool).
          Space toggles.
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
      {sandboxPaths && sandboxPaths.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text>Sandbox write paths:</Text>
          {sandboxPaths.map((p, i) => (
            <Text key={`${i}:${p}`} dimColor>
              {"  "}
              {p}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
