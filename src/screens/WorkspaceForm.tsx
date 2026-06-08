import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { TextField } from "../components/TextField.tsx";
import {
  denormalizeRepos,
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

type Focus = "projectDir" | "worktreeDir" | "repos";
const FOCI: Focus[] = ["projectDir", "worktreeDir", "repos"];

export function WorkspaceForm({ draft, onChange, onBack }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [editing, setEditing] = useState<number | undefined>(undefined);
  const focus = FOCI[focusIndex] ?? "projectDir";
  const entries = normalizeRepos(draft.workspace.knownRepositories);
  const errors = repoErrors(entries);

  useInput(
    (_input, key) => {
      if (editing !== undefined) return;
      if (key.escape) onBack();
      if (key.downArrow) setFocusIndex((f) => Math.min(FOCI.length - 1, f + 1));
      if (key.upArrow) setFocusIndex((f) => Math.max(0, f - 1));
    },
    { isActive: editing === undefined },
  );

  function setField(path: string, value: string): void {
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        path,
        value.length === 0 ? undefined : value,
      ) as unknown as ConfigDraft,
    );
  }

  function commitEntries(next: RepoEntry[]): void {
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        "workspace.knownRepositories",
        denormalizeRepos(next),
      ) as unknown as ConfigDraft,
    );
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
      <Text bold>Workspace</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="projectDir"
          value={draft.workspace.projectDir}
          isActive={focus === "projectDir"}
          onChange={(v) => setField("workspace.projectDir", v)}
        />
        <TextField
          label="worktreeDir"
          value={draft.workspace.worktreeDir ?? ""}
          placeholder={`${draft.workspace.projectDir}  (default)`}
          isActive={focus === "worktreeDir"}
          onChange={(v) => setField("workspace.worktreeDir", v)}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>knownRepositories</Text>
        <ListField
          items={items}
          isActive={focus === "repos"}
          onActivate={(index) =>
            setEditing(index === entries.length ? entries.length : index)
          }
          onDelete={(index) =>
            commitEntries(entries.filter((_, i) => i !== index))
          }
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          projectDir is groundcrew's base folder; worktrees go to
          &lt;worktreeDir&gt;/&lt;repo&gt;-&lt;TICKET&gt;/ (defaults to
          projectDir).
        </Text>
      </Box>
    </Box>
  );
}
