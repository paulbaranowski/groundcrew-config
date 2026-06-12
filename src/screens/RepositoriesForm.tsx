import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import {
  denormalizeRepos,
  duplicateEntry,
  normalizeRepos,
  repoErrors,
  type RepoEntry,
} from "../domain/repoEntries.ts";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { RepoSubForm } from "./RepoSubForm.tsx";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// Section editor for workspace.knownRepositories: a ListField of repo entries
// with add/edit/duplicate/delete, each edited via RepoSubForm. Follows the screen
// contract — see SectionForm.
export function RepositoriesForm({ draft, onChange, onBack }: Props) {
  const [editing, setEditing] = useState<number | undefined>(undefined);
  const entries = normalizeRepos(draft.workspace.knownRepositories);
  const errors = repoErrors(entries);

  useInput(
    (_input, key) => {
      if (editing !== undefined) return;
      if (key.escape) onBack();
    },
    { isActive: editing === undefined },
  );

  function commitEntries(next: RepoEntry[]): void {
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        "workspace.knownRepositories",
        denormalizeRepos(next),
      ) as unknown as ConfigDraft,
    );
  }

  // Copy a repo (name + every per-repo override) into a uniquely-named entry
  // right after the original, then open it in the sub-form for review/rename.
  function duplicateAt(index: number): void {
    const source = entries[index];
    if (source === undefined) return;
    const copy = duplicateEntry(
      source,
      entries.map((entry) => entry.name),
    );
    const next = [...entries];
    next.splice(index + 1, 0, copy);
    commitEntries(next);
    setEditing(index + 1);
  }

  if (editing !== undefined) {
    const current = entries[editing] ?? {
      name: "",
      projectDirOverride: undefined,
    };
    return (
      <RepoSubForm
        entry={current}
        projectDir={draft.workspace.projectDir}
        onSave={(entry) => {
          const next = [...entries];
          next[editing] = entry;
          commitEntries(next);
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const items: ListItem[] = entries.map((entry, index) => ({
    label: entry.name,
    note: entry.projectDirOverride
      ? `→ at ${entry.projectDirOverride}`
      : undefined,
    error: errors[index],
  }));

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Repositories</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive
          onActivate={(index) =>
            setEditing(index === entries.length ? entries.length : index)
          }
          onDelete={(index) =>
            commitEntries(entries.filter((_, i) => i !== index))
          }
          itemActions={[{ key: "c", onPress: duplicateAt }]}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          The repos groundcrew is allowed to work on, listed by their local
          folder name (each must already exist under your projectDir). ↑/↓ move ·
          enter edit · c duplicate · d delete · esc back.
        </Text>
      </Box>
    </Box>
  );
}
