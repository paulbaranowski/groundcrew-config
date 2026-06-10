import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import {
  applyShellFields,
  readShellFields,
  type ShellFields,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

type Source = NonNullable<ConfigDraft["sources"]>[number];

interface Props {
  source: Source | undefined;
  onSave: (source: Source) => void;
  onCancel: () => void;
}

const ROWS: Array<{ key: keyof ShellFields; label: string; placeholder: string }> = [
  { key: "name", label: "name", placeholder: "kebab-case, e.g. jira" },
  { key: "verify", label: "commands.verify", placeholder: "connectivity check (optional)" },
  { key: "listTasks", label: "commands.listTasks", placeholder: "emit ShellIssue[] JSON (required)" },
  { key: "getTask", label: "commands.getTask", placeholder: "emit one ShellIssue for ${id}" },
  { key: "markInProgress", label: "commands.markInProgress", placeholder: "move ${id} in-progress" },
  { key: "markInReview", label: "commands.markInReview", placeholder: "move ${id} in-review" },
  { key: "markDone", label: "commands.markDone", placeholder: "move ${id} done" },
  { key: "cwd", label: "cwd", placeholder: "working dir for commands (optional)" },
];

export function ShellSourceSubForm({ source, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<ShellFields>(() => readShellFields(source));
  const [active, setActive] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onCancel();
    if (key.downArrow) setActive((a) => Math.min(ROWS.length - 1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
    if (key.return) onSave(applyShellFields(source, fields));
  });

  const nameMissing = fields.name.trim().length === 0;
  const listTasksMissing = fields.listTasks.trim().length === 0;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Shell source</Text>
      <Box flexDirection="column" marginTop={1}>
        {ROWS.map((row, index) => (
          <TextField
            key={row.key}
            label={row.label}
            value={fields[row.key]}
            placeholder={row.placeholder}
            isActive={active === index}
            onChange={(v) => setFields((f) => ({ ...f, [row.key]: v }))}
          />
        ))}
      </Box>
      {nameMissing || listTasksMissing ? (
        <Box marginTop={1} flexDirection="column">
          {nameMissing ? (
            <Text color="yellow">⚠ name is required (kebab-case).</Text>
          ) : null}
          {listTasksMissing ? (
            <Text color="yellow">
              ⚠ commands.listTasks is required (or the legacy fetch alias).
            </Text>
          ) : null}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ move · type to edit · enter save · esc cancel. {"${id}"} is
          substituted per task. timeouts/env stay in Custom JSON.
        </Text>
      </Box>
    </Box>
  );
}
