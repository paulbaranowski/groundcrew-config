import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { TextField } from "../components/TextField.tsx";
import { modifiedByKey } from "../domain/modified.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { probePreLaunch, type ProbeResult } from "../io/probePreLaunch.ts";
import { SaveGuard } from "./SaveGuard.tsx";

interface Props {
  names: string[];
  /** The baseline name list to diff against for per-row `●` markers. */
  baselineNames: string[];
  onChange: (next: string[]) => void;
  onBack: () => void;
  /**
   * The agent's buffered `preLaunch` hook. When non-empty, `t` dry-runs it and
   * reports each name's resulting value length — catching a hook that exports an
   * empty string (mistyped token file, empty file) before it becomes a 401 at
   * launch. Absent/blank → no hook to test, so the affordance is hidden.
   */
  preLaunch?: string;
  /** cwd for the dry-run (defaults to the process cwd). */
  probeCwd?: string;
  /** Injectable for tests so component specs never spawn a real shell. */
  probe?: typeof probePreLaunch;
}

/** Async lifecycle of the `t` dry-run. */
type ProbeState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ProbeResult }
  | { kind: "error"; message: string };

/** Editing target: the index of an existing entry, or "new" for an unsaved add. */
type Editing = number | "new";

/**
 * Single-field editor for one env var name, mounted fresh per edit so its local
 * state seeds cleanly from `value` (the same trick `ShellSandboxPathsEditor`'s
 * entry editor uses). Enter commits, esc discards — neither touches the parent
 * list directly.
 */
function NameEntryEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(value);
  const guard = useEditGuard();

  useInput(
    (_input, k) => {
      if (k.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      // Gate Enter on a non-blank name so blank rows never reach the parent list
      // (groundcrew rejects a blank env var name anyway). Mirrors the sandbox
      // path editor.
      if (k.return && name.trim().length > 0) onSave(name);
    },
    { isActive: !guard.guarding },
  );

  if (guard.guarding) {
    // Mirror the Enter gate above: a blank name must never reach the parent
    // buffer, even after dirty-esc → Apply. If the buffer is whitespace-only,
    // treat Apply as Discard.
    const apply = name.trim().length === 0 ? onCancel : () => onSave(name);
    return (
      <SaveGuard
        onApply={apply}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>preLaunchEnv name</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="name"
          value={name}
          placeholder="POSIX env var name, e.g. GITHUB_TOKEN"
          isActive
          onChange={guard.track(setName)}
        />
      </Box>
      {name.trim().length === 0 ? (
        <Box marginTop={1}>
          <Text color="yellow">⚠ name is required (a blank row is dropped).</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>type to edit · enter apply · esc cancel.</Text>
      </Box>
    </Box>
  );
}

/**
 * Edits an agent definition's `preLaunchEnv` as an ordered list of single-name
 * rows. Mirrors `ShellSandboxPathsEditor`: one editable string per row, list
 * order preserved on save. `applyAgentFields` drops blank rows and omits the
 * key entirely when the list ends up empty. Editing each name as its own entry
 * avoids the separator ambiguity a single comma-list field had (a space-typed
 * "A B" would otherwise become one invalid array element).
 */
export function PreLaunchEnvEditor({
  names,
  baselineNames,
  onChange,
  onBack,
  preLaunch,
  probeCwd,
  probe = probePreLaunch,
}: Props) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const [probeState, setProbeState] = useState<ProbeState>({ kind: "idle" });
  // Names can collide (blank rows being the obvious case); fall back to a
  // positional key for those so two blank rows aren't diffed against the same
  // baseline entry.
  const modified = modifiedByKey(
    names,
    baselineNames,
    (n, i) => n || `__blank__${i}`,
  );

  const canProbe =
    (preLaunch ?? "").trim().length > 0 && names.length > 0;

  function runProbe(): void {
    setProbeState({ kind: "running" });
    // useInput handlers can't be async; fire-and-forget and settle into state.
    void probe(preLaunch ?? "", names, { cwd: probeCwd })
      .then((result) => setProbeState({ kind: "done", result }))
      .catch((error: unknown) =>
        setProbeState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
  }

  // No SaveGuard here: this list view holds nothing dirty of its own — every
  // committed edit has already flowed through onChange into the parent
  // AgentSubForm's `fields.preLaunchEnv` buffer (which has its own guard). The
  // dirty state lives in NameEntryEditor while one row is editing.
  useInput(
    (input, key) => {
      if (key.escape) {
        // Esc first dismisses a shown result, then leaves — so a glance at the
        // dry-run doesn't cost the whole editor.
        if (probeState.kind !== "idle") setProbeState({ kind: "idle" });
        else onBack();
        return;
      }
      if (input === "t" && canProbe && probeState.kind !== "running") runProbe();
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    const value = editing === "new" ? "" : (names[editing] ?? "");
    return (
      <NameEntryEditor
        key={String(editing)}
        value={value}
        onSave={(next) => {
          onChange(
            editing === "new"
              ? [...names, next]
              : names.map((n, i) => (i === editing ? next : n)),
          );
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const items: ListItem[] = names.map((name, index) => ({
    label: name || "(unnamed)",
    note: undefined,
    error: undefined,
    modified: modified[index],
  }));

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>preLaunchEnv</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={items}
          isActive
          addLabel="+ add env name…"
          onActivate={(index) => setEditing(index >= names.length ? "new" : index)}
          onDelete={(index) => onChange(names.filter((_, i) => i !== index))}
        />
      </Box>
      <ProbePanel state={probeState} />
      <Box marginTop={1}>
        <Text dimColor>
          Env var names groundcrew forwards into this agent when it launches.
          Each name is one entry. ↑/↓ move · enter edit · d delete ·{" "}
          {canProbe ? "t dry-run preLaunch · " : ""}esc back.
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Renders the `t` dry-run outcome. A length of 0 is the headline signal — it's
 * the empty export that a plain `env | grep` would miss and that surfaces later
 * as a generic 401. Exit code is shown but deliberately secondary: bash's
 * `export X="$(cat …)"` returns 0 even when the substitution fails, so length —
 * not exit code — is the reliable tell.
 */
function ProbePanel({ state }: { state: ProbeState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "running") {
    return (
      <Box marginTop={1}>
        <Text dimColor>running preLaunch…</Text>
      </Box>
    );
  }
  if (state.kind === "error") {
    return (
      <Box marginTop={1}>
        <Text color="red">✗ could not run preLaunch: {state.message}</Text>
      </Box>
    );
  }

  const { rows, exitCode, stderr, skipped } = state.result;
  const stderrLine = stderr.split("\n").find((l) => l.trim().length > 0);
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text bold>preLaunch dry-run</Text>
      {rows.map((row) =>
        row.length > 0 ? (
          <Text key={row.name} color="green">
            ✓ {row.name} len={row.length}
          </Text>
        ) : (
          <Text key={row.name} color="red">
            ✗ {row.name} empty (len=0) — hook did not set it
          </Text>
        ),
      )}
      {exitCode !== 0 ? (
        <Text color="yellow">⚠ hook exited {exitCode}</Text>
      ) : null}
      {stderrLine ? <Text color="yellow">stderr: {stderrLine}</Text> : null}
      {skipped.length > 0 ? (
        <Text color="yellow">
          skipped (not POSIX names): {skipped.join(", ")}
        </Text>
      ) : null}
      <Text dimColor>
        Paths resolve against the worktree at launch; here they run from the
        config dir. esc dismisses.
      </Text>
    </Box>
  );
}
