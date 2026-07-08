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
  type DiscoveryState =
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "picking"; candidates: DiscoveredRepo[] };
  const [discovery, setDiscoveryState] = useState<DiscoveryState>({
    phase: "idle",
  });
  // Mirror the phase in a ref: a burst of keystrokes delivered in one input
  // tick shares a stale `discovery` closure until React re-renders, so the
  // handler below must read `phaseRef.current` (not `discovery.phase`) to see
  // an f-then-esc pair land correctly. `setDiscovery` keeps both in sync.
  const phaseRef = useRef<DiscoveryState["phase"]>("idle");
  function setDiscovery(next: DiscoveryState): void {
    phaseRef.current = next.phase;
    setDiscoveryState(next);
  }
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
  const inputActive =
    editing === undefined &&
    pendingDelete === undefined &&
    discovery.phase !== "picking";
  useInput(
    (input, key) => {
      if (phaseRef.current === "loading") {
        if (key.escape) {
          discoveryReq.current += 1;
          setDiscovery({ phase: "idle" });
        }
        return;
      }
      // Past the loading branch the phase is idle (picking is gated off via
      // isActive, editing/pendingDelete both cleared).
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
          // Discovery keys candidates on owner/repo, but knownRepositories keys
          // on folder name alone - so two picked rows (acme/widgets,
          // fork/widgets) collapse to one entry. Dedupe by name against the
          // existing entries and within the batch so a commit can never append
          // a duplicate that would immediately flag a duplicate-name error.
          const seen = new Set(entries.map((e) => e.name));
          const additions: RepoEntry[] = [];
          for (const name of names) {
            if (seen.has(name)) continue;
            seen.add(name);
            additions.push({ name, projectDirOverride: undefined });
          }
          if (additions.length > 0) {
            // Existing entries (with their per-repo settings) pass through
            // untouched; denormalizeRepos keeps the additions as bare strings.
            commitEntries([...entries, ...additions]);
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
