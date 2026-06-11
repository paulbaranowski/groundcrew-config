import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { SaveGuard } from "./SaveGuard.tsx";
import type { RepoEntry } from "../domain/repoEntries.ts";

interface Props {
  entry: RepoEntry;
  projectDir: string;
  onSave: (entry: RepoEntry) => void;
  onCancel: () => void;
}

const FIELD_COUNT = 5;

export function RepoSubForm({ entry, projectDir, onSave, onCancel }: Props) {
  const [name, setName] = useState(entry.name);
  const [override, setOverride] = useState(entry.projectDirOverride ?? "");
  const [workdir, setWorkdir] = useState(entry.workdir ?? "");
  const [provisionCreate, setProvisionCreate] = useState(
    entry.provision?.create ?? "",
  );
  const [provisionRemove, setProvisionRemove] = useState(
    entry.provision?.remove ?? "",
  );
  const [active, setActive] = useState(0);
  const guard = useEditGuard();

  function buildEntry(): RepoEntry {
    const hasProvision =
      provisionCreate.trim().length > 0 || provisionRemove.trim().length > 0;
    return {
      name,
      projectDirOverride: override.length === 0 ? undefined : override,
      workdir: workdir.length === 0 ? undefined : workdir,
      provision: hasProvision
        ? { create: provisionCreate, remove: provisionRemove }
        : undefined,
    };
  }

  useInput(
    (_input, key) => {
      if (key.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) setActive((a) => Math.min(FIELD_COUNT - 1, a + 1));
      if (key.upArrow) setActive((a) => Math.max(0, a - 1));
      if (key.return) onSave(buildEntry());
    },
    { isActive: !guard.guarding },
  );

  if (guard.guarding) {
    return (
      <SaveGuard
        label="repository"
        onSave={() => onSave(buildEntry())}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  const base = override.length === 0 ? projectDir : override;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Repository</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="name"
          value={name}
          isActive={active === 0}
          onChange={guard.track(setName)}
        />
        <TextField
          label="projectDirOverride"
          value={override}
          placeholder={`${projectDir}  (default)`}
          isActive={active === 1}
          onChange={guard.track(setOverride)}
        />
        <TextField
          label="workdir"
          value={workdir}
          placeholder="subdir within the worktree to start working from (optional)"
          isActive={active === 2}
          onChange={guard.track(setWorkdir)}
        />
        <TextField
          label="provision.create"
          value={provisionCreate}
          placeholder="replaces `git worktree add`; vars: ${repo} ${branch} ${dir} ${baseRef} ${task}"
          isActive={active === 3}
          onChange={guard.track(setProvisionCreate)}
        />
        <TextField
          label="provision.remove"
          value={provisionRemove}
          placeholder="replaces `git worktree remove`; vars: ${repo} ${branch} ${dir} ${baseRef} ${task}"
          isActive={active === 4}
          onChange={guard.track(setProvisionRemove)}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Repo located at: {base}/{name}
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          Settings for one repository. "name" is its folder name; everything else
          is an optional override. provision is scripted worktree setup — it needs
          both templates and can't combine with projectDirOverride.
        </Text>
      </Box>
    </Box>
  );
}
