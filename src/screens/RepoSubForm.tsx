import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import type { RepoEntry } from "../domain/repoEntries.ts";

interface Props {
  entry: RepoEntry;
  projectDir: string;
  onSave: (entry: RepoEntry) => void;
  onCancel: () => void;
}

export function RepoSubForm({ entry, projectDir, onSave, onCancel }: Props) {
  const [name, setName] = useState(entry.name);
  const [override, setOverride] = useState(entry.projectDirOverride ?? "");
  const [active, setActive] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onCancel();
    if (key.downArrow) setActive((a) => Math.min(1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
    if (key.return) {
      onSave({
        name,
        projectDirOverride: override.length === 0 ? undefined : override,
      });
    }
  });

  const base = override.length === 0 ? projectDir : override;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Repository</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="name"
          value={name}
          isActive={active === 0}
          onChange={setName}
        />
        <TextField
          label="projectDirOverride"
          value={override}
          placeholder={`${projectDir}  (default)`}
          isActive={active === 1}
          onChange={setOverride}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Repo located at: {base}/{name}
        </Text>
      </Box>
    </Box>
  );
}
