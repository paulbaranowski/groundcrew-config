import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { probePreLaunch, type ProbeResult } from "../io/probePreLaunch.ts";
import { PreLaunchEnvEditor } from "./PreLaunchEnvEditor.tsx";
import { SaveGuard } from "./SaveGuard.tsx";
import {
  applyAgentFields,
  readAgentFields,
  type AgentDef as Def,
  type AgentFields,
} from "../domain/agents.ts";

interface Props {
  name: string;
  def: Def;
  /** The matched baseline definition; undefined when this agent is newly enabled. */
  baselineDef: Def | undefined;
  /** When true, `sandbox.agent` is mandatory (runner resolves to sdx). */
  sandboxRequired: boolean;
  onSave: (def: Def) => void;
  onCancel: () => void;
  /** Injectable for tests so specs never spawn a real shell. */
  probe?: typeof probePreLaunch;
}

/** The text keys of AgentFields — every field except the `preLaunchEnv` list. */
type TextKey = Exclude<keyof AgentFields, "preLaunchEnv">;

// Rows in display order. Text rows are edited inline; the `env` row is a summary
// that opens a nested list editor on enter (like ShellSourceSubForm's env row),
// so a burst of typing/arrows never smashes multiple names into one field. The
// `action` row (test preLaunch) dry-runs the hook and reports each env var's
// value length — placed right under the launch fields it exercises.
type Row =
  | { kind: "text"; key: TextKey; label: string; placeholder: string }
  | { kind: "env"; label: string }
  | { kind: "action"; label: string };

const ROWS: Row[] = [
  { kind: "text", key: "cmd", label: "cmd", placeholder: "agent-native launch command" },
  { kind: "text", key: "color", label: "color", placeholder: "#C15F3C" },
  { kind: "text", key: "preLaunch", label: "preLaunch", placeholder: "shell run before launch (optional)" },
  { kind: "env", label: "preLaunchEnv" },
  { kind: "action", label: "test preLaunch" },
  { kind: "text", key: "sandboxAgent", label: "sandbox.agent", placeholder: "sbx agent name" },
];

/** Async lifecycle of the "test preLaunch" dry-run. */
type ProbeState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ProbeResult }
  | { kind: "error"; message: string };

export function AgentSubForm({
  name,
  def,
  baselineDef,
  sandboxRequired,
  onSave,
  onCancel,
  probe = probePreLaunch,
}: Props) {
  const [fields, setFields] = useState<AgentFields>(() => readAgentFields(def));
  const baselineFields = readAgentFields(baselineDef ?? {});
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"fields" | "env">("fields");
  const [probeState, setProbeState] = useState<ProbeState>({ kind: "idle" });
  const guard = useEditGuard();
  // Mirror the active row in a ref so a burst of keypresses in one render (each
  // useInput call shares a stale `active` closure until React re-renders) still
  // branches enter on the latest row — the same trick ShellSourceSubForm uses.
  // The handler MUST read `activeRef.current`, never the render-time `active`,
  // or a fast ↑/↓-then-enter branches on the pre-burst row.
  const activeRef = useRef(0);

  function moveActive(next: number): void {
    activeRef.current = next;
    setActive(next);
  }

  function runProbe(): void {
    // Nothing to exercise without a hook — say so rather than reporting every
    // var as len=0 (which would look like a false alarm).
    if (fields.preLaunch.trim().length === 0) {
      setProbeState({ kind: "error", message: "add a preLaunch hook to test it" });
      return;
    }
    setProbeState({ kind: "running" });
    // useInput handlers can't be async; fire-and-forget and settle into state.
    void probe(fields.preLaunch, fields.preLaunchEnv, {})
      .then((result) => setProbeState({ kind: "done", result }))
      .catch((error: unknown) =>
        setProbeState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
  }

  useInput(
    (_input, key) => {
      if (key.escape) {
        // Esc first dismisses a shown dry-run result, then cancels the form — so
        // a glance at the test doesn't cost the whole edit.
        if (probeState.kind !== "idle") {
          setProbeState({ kind: "idle" });
          return;
        }
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) moveActive(Math.min(ROWS.length - 1, activeRef.current + 1));
      if (key.upArrow) moveActive(Math.max(0, activeRef.current - 1));
      if (key.return) {
        const row = ROWS[activeRef.current];
        if (row?.kind === "env") setMode("env");
        else if (row?.kind === "action") runProbe();
        else onSave(applyAgentFields(def, fields));
      }
    },
    { isActive: mode === "fields" && !guard.guarding },
  );

  if (guard.guarding) {
    return (
      <SaveGuard
        onApply={() => onSave(applyAgentFields(def, fields))}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  if (mode === "env") {
    return (
      <PreLaunchEnvEditor
        names={fields.preLaunchEnv}
        baselineNames={baselineFields.preLaunchEnv}
        onChange={(preLaunchEnv) => {
          guard.markDirty();
          setFields((f) => ({ ...f, preLaunchEnv }));
        }}
        onBack={() => setMode("fields")}
      />
    );
  }

  const sandboxMissing = sandboxRequired && fields.sandboxAgent.trim().length === 0;
  const envModified =
    baselineDef === undefined ||
    !valuesEqual(fields.preLaunchEnv, baselineFields.preLaunchEnv);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Agent: {name}</Text>
      <Box flexDirection="column" marginTop={1}>
        {ROWS.map((row, index) => {
          if (row.kind === "env") {
            const envActive = active === index;
            const envCount = fields.preLaunchEnv.length;
            return (
              <Box key="preLaunchEnv">
                <Text color={envActive ? "cyan" : undefined}>
                  {envActive ? "› " : "  "}
                  {row.label}{" "}
                </Text>
                <Text dimColor>
                  {envCount} name{envCount === 1 ? "" : "s"} — enter to edit
                </Text>
                {envModified ? <Text color="yellow"> ●</Text> : null}
              </Box>
            );
          }
          if (row.kind === "action") {
            const actionActive = active === index;
            const canTest = fields.preLaunch.trim().length > 0;
            return (
              <Box key="test">
                <Text color={actionActive ? "cyan" : undefined} dimColor={!canTest}>
                  {actionActive ? "› " : "  "}
                  {row.label}
                  {canTest ? " — enter to dry-run" : " — add a preLaunch hook first"}
                </Text>
              </Box>
            );
          }
          // For a newly-enabled agent (no baseline def) every field reads as modified.
          const modified =
            baselineDef === undefined ||
            !valuesEqual(fields[row.key], baselineFields[row.key]);
          return (
            <TextField
              key={row.key}
              label={row.label}
              value={fields[row.key]}
              placeholder={
                row.key === "sandboxAgent" && sandboxRequired
                  ? "required for runner: sdx"
                  : row.placeholder
              }
              isActive={active === index}
              modified={modified}
              onChange={(v) => {
                guard.markDirty();
                setFields((f) => ({ ...f, [row.key]: v }));
              }}
            />
          );
        })}
      </Box>
      <ProbePanel state={probeState} />
      {sandboxMissing ? (
        <Box marginTop={1}>
          <Text color="yellow">
            ⚠ runner resolves to sdx — sandbox.agent is required or launch fails.
          </Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          Fine-tune how this agent launches — most people can leave these blank.
          Blank fields inherit the built-in preset. ↑/↓ move · type to edit ·
          enter apply (or run on “test preLaunch”) · esc cancel.
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Renders the "test preLaunch" dry-run outcome. A length of 0 is the headline
 * signal — it's the empty export that a plain `env | grep` would miss and that
 * surfaces later as a generic 401. Exit code is shown but deliberately
 * secondary: bash's `export X="$(cat …)"` returns 0 even when the substitution
 * fails, so length — not exit code — is the reliable tell.
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
        <Text color="red">✗ {state.message}</Text>
      </Box>
    );
  }

  const { rows, exitCode, stderr, skipped } = state.result;
  const stderrLine = stderr.split("\n").find((l) => l.trim().length > 0);
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text bold>preLaunch dry-run</Text>
      {rows.length === 0 ? (
        <Text dimColor>hook ran; no preLaunchEnv names to measure.</Text>
      ) : null}
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
