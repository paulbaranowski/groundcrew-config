import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { setByPath } from "../domain/draftPath.ts";
import { isUsageDisabled, setUsageDisabled } from "../domain/usage.ts";
import { ORCHESTRATOR_DEFAULTS, type ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

export function UsageForm({ draft, onChange, onBack }: Props) {
  const disabled = isUsageDisabled(draft.agents);
  const hasAgents = Object.keys(draft.agents?.definitions ?? {}).length > 0;
  // Two focusable rows: 0 = the tracking on/off toggle, 1 = the limit field.
  const [active, setActive] = useState(0);

  const limit = draft.orchestrator?.sessionLimitPercentage;

  function setLimit(raw: string): void {
    const value = raw.length === 0 ? undefined : Number(raw);
    // Ignore non-numeric input rather than store NaN (which serializes to null
    // and produces an invalid config). groundcrew validates the (0, 100] range.
    if (value !== undefined && !Number.isFinite(value)) return;
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        "orchestrator.sessionLimitPercentage",
        value,
      ) as unknown as ConfigDraft,
    );
  }

  useInput((input, key) => {
    if (key.escape) onBack();
    if (key.downArrow) setActive((a) => Math.min(1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
    if (input === " " && active === 0 && hasAgents) {
      onChange({ ...draft, agents: setUsageDisabled(draft.agents, !disabled) });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Usage Limits</Text>
      <Box marginTop={1}>
        <Text color={active === 0 ? "cyan" : undefined}>
          {active === 0 ? "› " : "  "}
          Usage tracking:{" "}
          <Text color={disabled ? "yellow" : "green"}>
            {disabled ? "disabled" : "enabled"}
          </Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextField
          label="sessionLimitPercentage"
          value={limit === undefined ? "" : String(limit)}
          placeholder={`${ORCHESTRATOR_DEFAULTS.sessionLimitPercentage}  (default)`}
          isActive={active === 1}
          onChange={setLimit}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Usage tracking lets groundcrew watch your AI subscription's usage so it
          won't launch agents when you're near your limits. Disabling opts every
          enabled agent out; the limit % is the ceiling above which it stops
          launching new agents. ↑/↓ move · space toggles tracking.
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
