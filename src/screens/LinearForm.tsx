import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { linearApiKeyStatus } from "../domain/env.ts";
import {
  getLinearField,
  getLinearStatuses,
  isLinearEnabled,
  setLinearEnabled,
  setLinearField,
  setLinearStatuses,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
  /** Injected for testability; defaults to the real process env. */
  env?: Record<string, string | undefined>;
}

// Row 0 is the enable toggle; the rest are text fields shown only when enabled.
// Keeping the toggle on its own row means Space types into a focused field
// (Linear status names like "In Progress" contain spaces) instead of toggling.
const FIELD_ROWS = [
  { key: "team", label: "team" },
  { key: "name", label: "name" },
  { key: "inProgress", label: "statuses.inProgress" },
  { key: "inReview", label: "statuses.inReview" },
] as const;

export function LinearForm({ draft, onChange, onBack, env = process.env }: Props) {
  const enabled = isLinearEnabled(draft);
  const key = linearApiKeyStatus(env);
  const [focus, setFocus] = useState(0);
  const maxRow = enabled ? FIELD_ROWS.length : 0;
  const row = Math.min(focus, maxRow);

  useInput((input, k) => {
    if (k.escape) {
      onBack();
      return;
    }
    if (k.downArrow) setFocus((f) => Math.min(maxRow, f + 1));
    if (k.upArrow) setFocus((f) => Math.max(0, f - 1));
    // Space toggles only on the enable row, so it stays typeable in fields.
    if (input === " " && row === 0) onChange(setLinearEnabled(draft, !enabled));
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Linear (built-in)</Text>
      <Box marginTop={1}>
        <Text color={row === 0 ? "cyan" : undefined}>
          {row === 0 ? "▸ " : "  "}Built-in Linear source:{" "}
          <Text color={enabled ? "green" : "yellow"}>
            {enabled ? "enabled" : "disabled"}
          </Text>
        </Text>
      </Box>
      {enabled ? (
        <Box flexDirection="column" marginTop={1}>
          {FIELD_ROWS.map((field, index) => {
            const isStatus =
              field.key === "inProgress" || field.key === "inReview";
            const value = isStatus
              ? getLinearStatuses(draft, field.key)
              : getLinearField(draft, field.key) ?? "";
            return (
              <TextField
                key={field.key}
                label={field.label}
                value={value}
                placeholder={
                  isStatus ? "comma-separated names  (optional)" : "(optional)"
                }
                isActive={row === index + 1}
                onChange={(v) =>
                  onChange(
                    isStatus
                      ? setLinearStatuses(draft, field.key, v)
                      : setLinearField(draft, field.key, v),
                  )
                }
              />
            );
          })}
        </Box>
      ) : null}
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
          Pull tickets from Linear. Space toggles the source (top row). team/name
          and the inProgress/inReview status names are optional overrides. Your
          API key is read from the environment, not stored here.
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
