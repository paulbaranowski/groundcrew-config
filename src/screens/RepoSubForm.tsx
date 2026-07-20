import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { SaveGuard } from "./SaveGuard.tsx";
import type { RepoEntry } from "../domain/repoEntries.ts";

interface Props {
  entry: RepoEntry;
  /** The matched baseline entry; undefined for a newly-added entry. */
  baselineEntry: RepoEntry | undefined;
  projectDir: string;
  onSave: (entry: RepoEntry) => void;
  onCancel: () => void;
}

const FIELD_COUNT = 7;

export function RepoSubForm({
  entry,
  baselineEntry,
  projectDir,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(entry.name);
  const [override, setOverride] = useState(entry.projectDirOverride ?? "");
  const [workdir, setWorkdir] = useState(entry.workdir ?? "");
  const [provisionCreate, setProvisionCreate] = useState(
    entry.provision?.create ?? "",
  );
  const [provisionRemove, setProvisionRemove] = useState(
    entry.provision?.remove ?? "",
  );
  const [prepareHook, setPrepareHook] = useState(entry.prepareWorktreeHook ?? "");
  const [unsandboxedHook, setUnsandboxedHook] = useState(
    entry.unsandboxedPrepareWorktreeHook ?? "",
  );
  const [active, setActive] = useState(0);
  const guard = useEditGuard();

  // For a newly-added entry (no matching baseline) every field reads as modified.
  const nameModified =
    baselineEntry === undefined || !valuesEqual(name, baselineEntry.name);
  const overrideModified =
    baselineEntry === undefined ||
    !valuesEqual(
      override.length === 0 ? undefined : override,
      baselineEntry.projectDirOverride,
    );
  const workdirModified =
    baselineEntry === undefined ||
    !valuesEqual(
      workdir.length === 0 ? undefined : workdir,
      baselineEntry.workdir,
    );
  const provisionCreateModified =
    baselineEntry === undefined ||
    !valuesEqual(provisionCreate, baselineEntry.provision?.create ?? "");
  const provisionRemoveModified =
    baselineEntry === undefined ||
    !valuesEqual(provisionRemove, baselineEntry.provision?.remove ?? "");
  const prepareHookModified =
    baselineEntry === undefined ||
    !valuesEqual(
      prepareHook.length === 0 ? undefined : prepareHook,
      baselineEntry.prepareWorktreeHook,
    );
  const unsandboxedHookModified =
    baselineEntry === undefined ||
    !valuesEqual(
      unsandboxedHook.length === 0 ? undefined : unsandboxedHook,
      baselineEntry.unsandboxedPrepareWorktreeHook,
    );

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
      prepareWorktreeHook: prepareHook.length === 0 ? undefined : prepareHook,
      unsandboxedPrepareWorktreeHook:
        unsandboxedHook.length === 0 ? undefined : unsandboxedHook,
    };
  }

  // No activeRef mirror (cf. ShellSourceSubForm): Enter calls buildEntry() which
  // reads name/override/workdir/provision/prepareHook — never `active` — so the
  // usual useInput stale-closure trap doesn't apply here. If a future change
  // makes Enter branch on the active row, add the ref pattern.
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
        onApply={() => onSave(buildEntry())}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  // `projectDirOverride` and `provision` are mutually exclusive (groundcrew
  // rejects the combo; see `repoEntries.ts`). Enforce it in the editor: an empty
  // field goes inert once its counterpart is filled, so the invalid state can't
  // be typed in the first place. Both being filled (a legacy/invalid config)
  // disables neither, so the user can still clear one to fix it.
  const overrideFilled = override.trim().length > 0;
  const provisionFilled =
    provisionCreate.trim().length > 0 || provisionRemove.trim().length > 0;
  const overrideDisabled = provisionFilled && !overrideFilled;
  const provisionDisabled = overrideFilled && !provisionFilled;

  const base = override.length === 0 ? projectDir : override;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Repository</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="name"
          value={name}
          isActive={active === 0}
          modified={nameModified}
          onChange={guard.track(setName)}
        />
        <TextField
          label="projectDirOverride"
          value={override}
          placeholder={`${projectDir}  (default)`}
          isActive={active === 1}
          modified={overrideModified}
          onChange={guard.track(setOverride)}
          disabled={overrideDisabled}
          disabledHint="(disabled — clear provision to use)"
        />
        <TextField
          label="workdir"
          value={workdir}
          placeholder="subdir within the worktree to start working from (optional)"
          isActive={active === 2}
          modified={workdirModified}
          onChange={guard.track(setWorkdir)}
        />
        <TextField
          label="provision.create"
          value={provisionCreate}
          placeholder="replaces `git worktree add`; vars: ${repo} ${branch} ${dir} ${baseRef} ${task}"
          isActive={active === 3}
          modified={provisionCreateModified}
          onChange={guard.track(setProvisionCreate)}
          disabled={provisionDisabled}
          disabledHint="(disabled — clear projectDirOverride to use)"
        />
        <TextField
          label="provision.remove"
          value={provisionRemove}
          placeholder="replaces `git worktree remove`; vars: ${repo} ${branch} ${dir} ${baseRef} ${task}"
          isActive={active === 4}
          modified={provisionRemoveModified}
          onChange={guard.track(setProvisionRemove)}
          disabled={provisionDisabled}
          disabledHint="(disabled — clear projectDirOverride to use)"
        />
        <TextField
          label="hooks.prepareWorktree"
          value={prepareHook}
          placeholder="shell run inside a fresh worktree (optional)"
          isActive={active === 5}
          modified={prepareHookModified}
          onChange={guard.track(setPrepareHook)}
        />
        <TextField
          label="unsandboxedHooks.prepareWorktree"
          value={unsandboxedHook}
          placeholder="host-side setup (bin/setup, native builds) — runs OUTSIDE the sandbox (optional)"
          isActive={active === 6}
          modified={unsandboxedHookModified}
          onChange={guard.track(setUnsandboxedHook)}
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
      <Box marginTop={1}>
        <Text dimColor>
          hooks.prepareWorktree cascade: a repo-committed
          .groundcrew/config.json wins, then this per-repo setting, then
          defaults.hooks.prepareWorktree.
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          unsandboxedHooks.prepareWorktree is operator-only and per-repo (no
          defaults.*, no repo-committed override). Runs on the host BEFORE
          hooks.prepareWorktree — for native builds and host toolchains the
          sandbox blocks. Rejected under runner=sdx.
        </Text>
      </Box>
    </Box>
  );
}
