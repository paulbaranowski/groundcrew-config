import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { TextField } from "../components/TextField.tsx";
import { modifiedByKey } from "../domain/modified.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { SaveGuard } from "./SaveGuard.tsx";

interface Props {
  names: string[];
  /** The baseline name list to diff against for per-row `●` markers. */
  baselineNames: string[];
  onChange: (next: string[]) => void;
  onBack: () => void;
}

/** Editing target: the index of an existing entry, or "new" for an unsaved add. */
type Editing = number | "new";

/**
 * Single-field editor for one env var name, mounted fresh per edit so its local
 * state seeds cleanly from `value` (the same trick `ShellSandboxPathsEditor`'s
 * entry editor uses). Enter commits, esc discards — neither touches the parent
 * list directly.
 */
function NameEntryEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(value);
  const guard = useEditGuard();

  useInput(
    (_input, k) => {
      if (k.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      // Gate Enter on a non-blank name so blank rows never reach the parent list
      // (groundcrew rejects a blank env var name anyway). Mirrors the sandbox
      // path editor.
      if (k.return && name.trim().length > 0) onSave(name);
    },
    { isActive: !guard.guarding },
  );

  if (guard.guarding) {
    // Mirror the Enter gate above: a blank name must never reach the parent
    // buffer, even after dirty-esc → Apply. If the buffer is whitespace-only,
    // treat Apply as Discard.
    const apply = name.trim().length === 0 ? onCancel : () => onSave(name);
    return (
      <SaveGuard
        onApply={apply}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>preLaunchEnv name</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="name"
          value={name}
          placeholder="POSIX env var name, e.g. GITHUB_TOKEN"
          isActive
          onChange={guard.track(setName)}
        />
      </Box>
      {name.trim().length === 0 ? (
        <Box marginTop={1}>
          <Text color="yellow">⚠ name is required (a blank row is dropped).</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>type to edit · enter apply · esc cancel.</Text>
      </Box>
    </Box>
  );
}

/**
 * Edits an agent definition's `preLaunchEnv` as an ordered list of single-name
 * rows. Mirrors `ShellSandboxPathsEditor`: one editable string per row, list
 * order preserved on save. `applyAgentFields` drops blank rows and omits the
 * key entirely when the list ends up empty. Editing each name as its own entry
 * avoids the separator ambiguity a single comma-list field had (a space-typed
 * "A B" would otherwise become one invalid array element).
 */
export function PreLaunchEnvEditor({
  names,
  baselineNames,
  onChange,
  onBack,
}: Props) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  // Names can collide (blank rows being the obvious case); fall back to a
  // positional key for those so two blank rows aren't diffed against the same
  // baseline entry.
  const modified = modifiedByKey(
    names,
    baselineNames,
    (n, i) => n || `__blank__${i}`,
  );

  // No SaveGuard here: this list view holds nothing dirty of its own — every
  // committed edit has already flowed through onChange into the parent
  // AgentSubForm's `fields.preLaunchEnv` buffer (which has its own guard). The
  // dirty state lives in NameEntryEditor while one row is editing.
  useInput(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    const value = editing === "new" ? "" : (names[editing] ?? "");
    return (
      <NameEntryEditor
        key={String(editing)}
        value={value}
        onSave={(next) => {
          onChange(
            editing === "new"
              ? [...names, next]
              : names.map((n, i) => (i === editing ? next : n)),
          );
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const items: ListItem[] = names.map((name, index) => ({
    label: name || "(unnamed)",
    note: undefined,
    error: undefined,
    modified: modified[index],
  }));

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>preLaunchEnv</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive
          addLabel="+ add env name…"
          onActivate={(index) => setEditing(index >= names.length ? "new" : index)}
          onDelete={(index) => onChange(names.filter((_, i) => i !== index))}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Env var names groundcrew forwards into this agent when it launches.
          Each name is one entry. ↑/↓ move · enter edit · d delete · esc back.
        </Text>
      </Box>
    </Box>
  );
}
