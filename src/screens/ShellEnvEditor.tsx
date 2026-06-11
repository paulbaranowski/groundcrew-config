import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { TextField } from "../components/TextField.tsx";
import type { EnvEntry } from "../domain/sources.ts";

interface Props {
  env: EnvEntry[];
  onChange: (next: EnvEntry[]) => void;
  onBack: () => void;
}

/** Editing target: the index of an existing entry, or "new" for an unsaved add. */
type Editing = number | "new";

/**
 * Two-field editor for one environment variable, mounted fresh per edit so its
 * local state seeds cleanly from `entry` (the same trick `ShellSourceSubForm`
 * uses). Enter commits, esc discards — neither touches the parent list directly.
 */
function EnvEntryEditor({
  entry,
  onSave,
  onCancel,
}: {
  entry: EnvEntry;
  onSave: (next: EnvEntry) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(entry.key);
  const [value, setValue] = useState(entry.value);
  const [active, setActive] = useState(0);

  useInput((_input, k) => {
    if (k.escape) onCancel();
    if (k.downArrow) setActive((a) => Math.min(1, a + 1));
    if (k.upArrow) setActive((a) => Math.max(0, a - 1));
    if (k.return) onSave({ key, value });
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Environment variable</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="key"
          value={key}
          placeholder="VAR_NAME"
          isActive={active === 0}
          onChange={setKey}
        />
        <TextField
          label="value"
          value={value}
          placeholder="stored literally in the config"
          isActive={active === 1}
          onChange={setValue}
        />
      </Box>
      {key.trim().length === 0 ? (
        <Box marginTop={1}>
          <Text color="yellow">⚠ key is required (a blank key is dropped).</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ move · type to edit · enter save · esc cancel.</Text>
      </Box>
    </Box>
  );
}

/**
 * Edits the `env` map of a shell source as an ordered list of key/value entries
 * (ListField + per-entry editor). Mirrors `ShellSourcesForm` → `ShellSourceSubForm`,
 * one level deeper. The list order is purely cosmetic — `applyShellFields`
 * collapses it back into a `Record` (later key wins, blank keys dropped).
 */
export function ShellEnvEditor({ env, onChange, onBack }: Props) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);

  useInput(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    const entry: EnvEntry =
      editing === "new" ? { key: "", value: "" } : (env[editing] ?? { key: "", value: "" });
    return (
      <EnvEntryEditor
        key={String(editing)}
        entry={entry}
        onSave={(next) => {
          onChange(
            editing === "new"
              ? [...env, next]
              : env.map((e, i) => (i === editing ? next : e)),
          );
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const items: ListItem[] = env.map((entry) => ({
    label: entry.key || "(unnamed)",
    note: `= ${entry.value || "(empty)"}`,
    error: undefined,
  }));

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Environment variables</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive
          addLabel="+ add variable…"
          onActivate={(index) => setEditing(index >= env.length ? "new" : index)}
          onDelete={(index) => onChange(env.filter((_, i) => i !== index))}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Extra environment variables passed to every command for this source
          (e.g. API tokens, hostnames). Stored literally in the config. ↑/↓ move ·
          enter edit · d delete · esc back.
        </Text>
      </Box>
    </Box>
  );
}
