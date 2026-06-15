import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { modifiedByKey } from "../domain/modified.ts";
import {
  setShellSources,
  shellListTasksCommand,
  shellSources,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { ShellSourceSubForm } from "./ShellSourceSubForm.tsx";

type Source = NonNullable<ConfigDraft["sources"]>[number];

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// Section editor for custom `kind:"shell"` task sources: a ListField of entries
// that delegates each one to ShellSourceSubForm. Follows the screen contract —
// see SectionForm.
export function ShellSourcesForm({
  draft,
  baseline,
  onChange,
  onBack,
}: Props) {
  const [editing, setEditing] = useState<number | undefined>(undefined);
  const entries = shellSources(draft);
  const baseEntries = shellSources(baseline);
  // Same positional fallback as ShellEnvEditor: a freshly-added source has no
  // name yet, and two unnamed sources would otherwise collide in modifiedByKey's
  // map (only the last would be diffed). Sources can't be saved without a name,
  // but the markers must still read correctly during that transient state.
  const modified = modifiedByKey(
    entries,
    baseEntries,
    (s, i) => s.name || `__blank__${i}`,
  );

  useInput(
    (_input, key) => {
      if (editing !== undefined) return;
      if (key.escape) onBack();
    },
    { isActive: editing === undefined },
  );

  function commit(next: Source[]): void {
    onChange(setShellSources(draft, next));
  }

  if (editing !== undefined) {
    const current = entries[editing];
    const baselineSource = baseEntries.find((e) => e.name === current?.name);
    return (
      <ShellSourceSubForm
        source={current}
        baselineSource={baselineSource}
        onSave={(source) => {
          const next = [...entries];
          next[editing] = source;
          commit(next);
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const items: ListItem[] = entries.map((entry, index) => {
    const listTasks = shellListTasksCommand(entry);
    return {
      label: entry.name || "(unnamed)",
      note: listTasks ? `→ ${listTasks}` : "⚠ no listTasks",
      error: undefined,
      modified: modified[index],
    };
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Shell sources</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive
          addLabel="+ add shell source…"
          onActivate={(index) => setEditing(index)}
          onDelete={(index) => commit(entries.filter((_, i) => i !== index))}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Connect any other tracker (Jira, GitHub Issues, …) by giving groundcrew
          shell commands that list and update its tasks. ↑/↓ move · enter edit · d
          delete · esc back.
        </Text>
      </Box>
    </Box>
  );
}
