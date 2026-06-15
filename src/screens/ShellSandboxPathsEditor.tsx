import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { TextField } from "../components/TextField.tsx";
import { modifiedByKey } from "../domain/modified.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { SaveGuard } from "./SaveGuard.tsx";

interface Props {
  paths: string[];
  /** The baseline path list to diff against for per-row `●` markers. */
  baselinePaths: string[];
  onChange: (next: string[]) => void;
  onBack: () => void;
}

/** Editing target: the index of an existing entry, or "new" for an unsaved add. */
type Editing = number | "new";

/**
 * Single-field editor for one sandbox path, mounted fresh per edit so its local
 * state seeds cleanly from `value` (the same trick `ShellEnvEditor`'s entry
 * editor uses). Enter commits, esc discards — neither touches the parent list
 * directly.
 */
function PathEntryEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [path, setPath] = useState(value);
  const guard = useEditGuard();

  useInput(
    (_input, k) => {
      if (k.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      // Gate Enter on a non-blank path so blank rows never reach the parent list.
      // ShellEnvEditor / EnvEntryEditor doesn't gate (the blank-key warning is
      // informational there); we tighten the new sandbox editor independently
      // because four reviewers flagged the `(unnamed)` row UX and the trim layer
      // in applyShellFields already enforces the invariant on save.
      if (k.return && path.trim().length > 0) onSave(path);
    },
    { isActive: !guard.guarding },
  );

  if (guard.guarding) {
    return (
      <SaveGuard
        label="path"
        onSave={() => onSave(path)}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Sandbox write path</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="path"
          value={path}
          placeholder="absolute or ~ path the command may write to"
          isActive
          onChange={guard.track(setPath)}
        />
      </Box>
      {path.trim().length === 0 ? (
        <Box marginTop={1}>
          <Text color="yellow">⚠ path is required (a blank row is dropped).</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>type to edit · enter save · esc cancel.</Text>
      </Box>
    </Box>
  );
}

/**
 * Edits a shell source's `sandboxWritePaths` (groundcrew ≥ 4.42) as an ordered
 * list of single-string rows. Mirrors `ShellEnvEditor` one layer deeper, but
 * with a single editable string per row instead of a key/value pair. The list
 * order is preserved on save; `applyShellFields` drops blank rows and omits the
 * key entirely when the list ends up empty.
 */
export function ShellSandboxPathsEditor({
  paths,
  baselinePaths,
  onChange,
  onBack,
}: Props) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  // Path strings can collide (blank rows being the obvious case); fall back to
  // a positional key for those so two blank rows aren't diffed against the
  // same baseline entry.
  const modified = modifiedByKey(
    paths,
    baselinePaths,
    (p, i) => p || `__blank__${i}`,
  );

  // No SaveGuard here: this list view holds nothing dirty of its own — every
  // committed edit has already flowed through onChange into the parent
  // ShellSourceSubForm's `fields.sandboxWritePaths` buffer (which has its own
  // guard). The dirty state lives in PathEntryEditor while one row is editing.
  useInput(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    const value = editing === "new" ? "" : (paths[editing] ?? "");
    return (
      <PathEntryEditor
        key={String(editing)}
        value={value}
        onSave={(next) => {
          onChange(
            editing === "new"
              ? [...paths, next]
              : paths.map((p, i) => (i === editing ? next : p)),
          );
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const items: ListItem[] = paths.map((path, index) => ({
    label: path || "(unnamed)",
    note: undefined,
    error: undefined,
    modified: modified[index],
  }));

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Sandbox write paths</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive
          addLabel="+ add path…"
          onActivate={(index) => setEditing(index >= paths.length ? "new" : index)}
          onDelete={(index) => onChange(paths.filter((_, i) => i !== index))}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Extra filesystem paths this source's commands may write to under
          groundcrew's sandbox. Stored literally; ~ is expanded by groundcrew.
          ↑/↓ move · enter edit · d delete · esc back.
        </Text>
      </Box>
    </Box>
  );
}
