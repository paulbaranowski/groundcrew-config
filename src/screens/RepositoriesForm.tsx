import { useRef, useState } from "react";
import { homedir } from "node:os";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { modifiedByKey } from "../domain/modified.ts";
import {
  denormalizeRepos,
  duplicateEntry,
  normalizeRepos,
  repoErrors,
  type RepoEntry,
} from "../domain/repoEntries.ts";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import type { DiscoveredRepo } from "../domain/setup/repoDiscovery.ts";
import { discoverRepos } from "../io/setup/discoverRepos.ts";
import { RepoSubForm } from "./RepoSubForm.tsx";
import { RepoDiscoveryPicker } from "./RepoDiscoveryPicker.tsx";
import { DeleteGuard } from "./DeleteGuard.tsx";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
  /** Injectable for tests; defaults to the real gh+local discovery (F6). */
  discover?: (workspaceDir: string | undefined) => Promise<DiscoveredRepo[]>;
}

// Section editor for workspace.knownRepositories: a ListField of repo entries
// with add/edit/duplicate/delete, each edited via RepoSubForm. Follows the screen
// contract — see SectionForm.
export function RepositoriesForm({
  draft,
  baseline,
  onChange,
  onBack,
  discover,
}: Props) {
  const [editing, setEditing] = useState<number | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<number | undefined>(
    undefined,
  );
  const [discovery, setDiscovery] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "picking"; candidates: DiscoveredRepo[] }
  >({ phase: "idle" });
  const runDiscovery =
    discover ?? ((workspaceDir) => discoverRepos(homedir(), workspaceDir));
  // Monotonic id of the in-flight discovery. Esc during loading bumps it so a
  // late-resolving scan can't pop the picker after the user backed out.
  const discoveryReq = useRef(0);
  const entries = normalizeRepos(draft.workspace.knownRepositories);
  const baseEntries = normalizeRepos(baseline.workspace.knownRepositories);
  const modified = modifiedByKey(entries, baseEntries, (entry) => entry.name);
  const errors = repoErrors(entries);

  // Esc-to-back and the `f` discovery trigger are live only on the bare list.
  // The handler itself stays active through `loading` too (so esc can cancel a
  // slow scan), but goes quiet while a sub-editor, the delete confirmation, or
  // the picker owns input - each of those handles its own esc.
  const listActive =
    editing === undefined &&
    pendingDelete === undefined &&
    discovery.phase === "idle";
  const inputActive =
    editing === undefined &&
    pendingDelete === undefined &&
    discovery.phase !== "picking";
  useInput(
    (input, key) => {
      if (discovery.phase === "loading") {
        if (key.escape) {
          discoveryReq.current += 1;
          setDiscovery({ phase: "idle" });
        }
        return;
      }
      if (!listActive) return;
      if (key.escape) onBack();
      if (input === "f") {
        const req = (discoveryReq.current += 1);
        setDiscovery({ phase: "loading" });
        void runDiscovery(draft.workspace.projectDir).then((candidates) => {
          if (discoveryReq.current === req) {
            setDiscovery({ phase: "picking", candidates });
          }
        });
      }
    },
    { isActive: inputActive },
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
    const baselineEntry = baseEntries.find((e) => e.name === current.name);
    return (
      <RepoSubForm
        entry={current}
        baselineEntry={baselineEntry}
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

  if (discovery.phase === "picking") {
    return (
      <RepoDiscoveryPicker
        candidates={discovery.candidates}
        existingNames={new Set(entries.map((e) => e.name))}
        onCommit={(names) => {
          if (names.length > 0) {
            // Append as minimal entries; denormalizeRepos keeps them as bare
            // strings, and existing entries (with their per-repo settings)
            // pass through untouched.
            commitEntries([
              ...entries,
              ...names.map((name) => ({
                name,
                projectDirOverride: undefined,
              })),
            ]);
          }
          setDiscovery({ phase: "idle" });
        }}
        onCancel={() => setDiscovery({ phase: "idle" })}
      />
    );
  }
  if (discovery.phase === "loading") {
    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Repositories</Text>
        <Box marginTop={1}>
          <Text dimColor>discovering repos (gh + local scan)… esc to cancel.</Text>
        </Box>
      </Box>
    );
  }

  const items: ListItem[] = entries.map((entry, index) => ({
    label: entry.name,
    note: entry.projectDirOverride
      ? `→ at ${entry.projectDirOverride}`
      : undefined,
    error: errors[index],
    modified: modified[index],
  }));

  if (pendingDelete !== undefined) {
    const target = entries[pendingDelete];
    return (
      <DeleteGuard
        name={target?.name ?? "this repo"}
        onConfirm={() => {
          commitEntries(entries.filter((_, i) => i !== pendingDelete));
          setPendingDelete(undefined);
        }}
        onCancel={() => setPendingDelete(undefined)}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Repositories</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive={pendingDelete === undefined}
          onActivate={(index) =>
            setEditing(index === entries.length ? entries.length : index)
          }
          onDelete={(index) => setPendingDelete(index)}
          itemActions={[{ key: "c", onPress: duplicateAt }]}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          The repos groundcrew is allowed to work on, listed by their local
          folder name (each must already exist under your projectDir). ↑/↓ move ·
          enter edit · c duplicate · d delete (confirm) · f discover · esc back.
        </Text>
      </Box>
    </Box>
  );
}
