import { Box, Text, useInput } from "ink";
import { linearApiKeyStatus } from "../domain/env.ts";
import { isLinearDisabled, setLinearEnabled } from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
  /** Injected for testability; defaults to the real process env. */
  env?: Record<string, string | undefined>;
}

export function LinearForm({ draft, onChange, onBack, env = process.env }: Props) {
  const disabled = isLinearDisabled(draft);
  const key = linearApiKeyStatus(env);

  useInput((input, { escape }) => {
    if (escape) onBack();
    // Pass the *current* disabled flag as the new `enabled` to flip the state.
    if (input === " ") onChange(setLinearEnabled(draft, disabled));
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
        <Text>
          API key:{" "}
          {key.set ? (
            <Text color="green">detected ({key.source})</Text>
          ) : (
            <Text color="yellow">not set</Text>
          )}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Space toggles the source. The key is read from your environment, not
          this config.
        </Text>
        {key.set ? null : (
          <Text dimColor>
            Set it: export GROUNDCREW_LINEAR_API_KEY="lin_api_..."
          </Text>
        )}
      </Box>
    </Box>
  );
}
