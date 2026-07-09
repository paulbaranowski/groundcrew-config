import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { ScrollableList, visibleRows } from "../components/ScrollableList.tsx";
import { useFullscreen } from "../hooks/useFullscreen.ts";
import type { DiscoveredRepo } from "../domain/setup/repoDiscovery.ts";

// Rows consumed by surrounding chrome (border, title, help, footer).
const PICKER_CHROME_ROWS = 9;

interface Props {
  candidates: DiscoveredRepo[];
  /** Repo names already in workspace.knownRepositories: shown, not toggleable. */
  existingNames: ReadonlySet<string>;
  /** Chosen repo names (folder names, not owner/repo), in candidate order. */
  onCommit: (names: string[]) => void;
  onCancel: () => void;
}

// Multi-select over discovered repos (F6). Selection state is index-keyed;
// already-added candidates render dim and cannot be toggled, so a commit can
// never produce a duplicate entry.
export function RepoDiscoveryPicker({
  candidates,
  existingNames,
  onCommit,
  onCancel,
}: Props) {
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const selectedRef = useRef<ReadonlySet<number>>(new Set());
  const { rows: terminalRows } = useFullscreen();
  const maxVisible = visibleRows(terminalRows, PICKER_CHROME_ROWS);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  // Selection mirrors ListField's cursorRef trick: a space-then-enter burst in
  // one input tick must see the toggle, so the handler reads refs, not state.
  // Uniqueness is by committed folder name (`name`), not owner/repo: two hits
  // that land in the same knownRepositories entry must not both be selectable.
  function toggle(index: number): void {
    const candidate = candidates[index];
    if (candidate === undefined || existingNames.has(candidate.name)) return;
    const next = new Set(selectedRef.current);
    if (next.has(index)) {
      next.delete(index);
    } else {
      const collides = [...next].some(
        (i) => candidates[i]?.name === candidate.name,
      );
      if (collides) return;
      next.add(index);
    }
    selectedRef.current = next;
    setSelected(next);
  }

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.downArrow)
      // Floor at 0 so an empty candidate list (length 0 → min(-1, …)) can't
      // drive the cursor negative.
      moveCursor(Math.max(0, Math.min(candidates.length - 1, cursorRef.current + 1)));
    if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
    if (input === " ") toggle(cursorRef.current);
    if (key.return) {
      const names = candidates
        .map((c, i) => (selectedRef.current.has(i) ? c.name : undefined))
        .filter((n): n is string => n !== undefined);
      onCommit(names);
    }
  });

  function renderRow(index: number) {
    const c = candidates[index]!;
    const added = existingNames.has(c.name);
    const checked = selected.has(index);
    // Surface the on-disk folder name when it differs from the repo slug, since
    // that (not owner/repo) is what gets committed.
    const folderNote = c.name !== c.repo ? ` → ${c.name}` : "";
    return (
      <Box key={`${c.owner}/${c.repo}`}>
        <Text color={cursor === index ? "cyan" : undefined} dimColor={added}>
          {cursor === index ? "▸ " : "  "}
          {added ? "[·]" : checked ? "[x]" : "[ ]"} {c.owner}/{c.repo}
          {folderNote}
        </Text>
        <Text dimColor>
          {" "}
          ({c.sources.join(", ")}){added ? " already added" : ""}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Discovered repositories</Text>
      <Box marginTop={1} flexDirection="column">
        {candidates.length === 0 ? (
          <Text dimColor>
            nothing found (gh not authed and no local clones?)
          </Text>
        ) : (
          <ScrollableList
            count={candidates.length}
            cursor={cursor}
            maxVisible={maxVisible}
            renderRow={renderRow}
          />
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ move · space select · enter add selected · esc cancel. Adds each
          repo by folder name; it must live under your projectDir.
        </Text>
      </Box>
    </Box>
  );
}
