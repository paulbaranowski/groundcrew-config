import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

type Focus = "projectDir" | "worktreeDir";
const FOCI: Focus[] = ["projectDir", "worktreeDir"];

// Section editor for the workspace paths (projectDir and worktreeDir). Follows
// the screen contract — see SectionForm.
export function WorkspaceForm({ draft, baseline, onChange, onBack }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const focus = FOCI[focusIndex] ?? "projectDir";

  useInput((_input, key) => {
    if (key.escape) onBack();
    if (key.downArrow) setFocusIndex((f) => Math.min(FOCI.length - 1, f + 1));
    if (key.upArrow) setFocusIndex((f) => Math.max(0, f - 1));
  });

  function setField(path: string, value: string): void {
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        path,
        value.length === 0 ? undefined : value,
      ) as unknown as ConfigDraft,
    );
  }

  const projectDirModified = !valuesEqual(
    baseline.workspace.projectDir,
    draft.workspace.projectDir,
  );
  const worktreeDirModified = !valuesEqual(
    baseline.workspace.worktreeDir,
    draft.workspace.worktreeDir,
  );

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Workspace</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="projectDir"
          value={draft.workspace.projectDir}
          isActive={focus === "projectDir"}
          modified={projectDirModified}
          onChange={(v) => setField("workspace.projectDir", v)}
        />
        <TextField
          label="worktreeDir"
          value={draft.workspace.worktreeDir ?? ""}
          placeholder={`${draft.workspace.projectDir}  (default)`}
          isActive={focus === "worktreeDir"}
          modified={worktreeDirModified}
          onChange={(v) => setField("workspace.worktreeDir", v)}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Where groundcrew keeps your code. projectDir is the folder that holds
          your repos; each task runs in a throwaway copy (a "git worktree")
          created under worktreeDir. Add the repos themselves in the Repositories
          section.
        </Text>
      </Box>
    </Box>
  );
}
