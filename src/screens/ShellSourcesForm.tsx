import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
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
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

export function ShellSourcesForm({ draft, onChange, onBack }: Props) {
  const [editing, setEditing] = useState<number | undefined>(undefined);
  const entries = shellSources(draft);

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
    return (
      <ShellSourceSubForm
        source={entries[editing]}
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

  const items: ListItem[] = entries.map((entry) => {
    const listTasks = shellListTasksCommand(entry);
    return {
      label: entry.name || "(unnamed)",
      note: listTasks ? `→ ${listTasks}` : "⚠ no listTasks",
      error: undefined,
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
