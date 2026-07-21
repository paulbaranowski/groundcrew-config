import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
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
}

/** The text keys of AgentFields — every field except the `preLaunchEnv` list. */
type TextKey = Exclude<keyof AgentFields, "preLaunchEnv">;

// Rows in display order. Text rows are edited inline; the `env` row is a summary
// that opens a nested list editor on enter (like ShellSourceSubForm's env row),
// so a burst of typing/arrows never smashes multiple names into one field.
type Row =
  | { kind: "text"; key: TextKey; label: string; placeholder: string }
  | { kind: "env"; label: string };

const ROWS: Row[] = [
  { kind: "text", key: "cmd", label: "cmd", placeholder: "agent-native launch command" },
  { kind: "text", key: "color", label: "color", placeholder: "#C15F3C" },
  { kind: "text", key: "preLaunch", label: "preLaunch", placeholder: "shell run before launch (optional)" },
  { kind: "env", label: "preLaunchEnv" },
  { kind: "text", key: "sandboxAgent", label: "sandbox.agent", placeholder: "sbx agent name" },
];

export function AgentSubForm({
  name,
  def,
  baselineDef,
  sandboxRequired,
  onSave,
  onCancel,
}: Props) {
  const [fields, setFields] = useState<AgentFields>(() => readAgentFields(def));
  const baselineFields = readAgentFields(baselineDef ?? {});
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"fields" | "env">("fields");
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

  useInput(
    (_input, key) => {
      if (key.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) moveActive(Math.min(ROWS.length - 1, activeRef.current + 1));
      if (key.upArrow) moveActive(Math.max(0, activeRef.current - 1));
      if (key.return) {
        if (ROWS[activeRef.current]?.kind === "env") setMode("env");
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
          enter apply · esc cancel.
        </Text>
      </Box>
    </Box>
  );
}
