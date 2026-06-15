import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
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

const ROWS: Array<{ key: keyof AgentFields; label: string; placeholder: string }> = [
  { key: "cmd", label: "cmd", placeholder: "agent-native launch command" },
  { key: "color", label: "color", placeholder: "#C15F3C" },
  { key: "preLaunch", label: "preLaunch", placeholder: "shell run before launch (optional)" },
  { key: "preLaunchEnv", label: "preLaunchEnv", placeholder: "comma-separated env names" },
  { key: "sandboxAgent", label: "sandbox.agent", placeholder: "sbx agent name" },
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
  const guard = useEditGuard();

  useInput(
    (_input, key) => {
      if (key.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) setActive((a) => Math.min(ROWS.length - 1, a + 1));
      if (key.upArrow) setActive((a) => Math.max(0, a - 1));
      if (key.return) onSave(applyAgentFields(def, fields));
    },
    { isActive: !guard.guarding },
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

  const sandboxMissing = sandboxRequired && fields.sandboxAgent.trim().length === 0;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Agent: {name}</Text>
      <Box flexDirection="column" marginTop={1}>
        {ROWS.map((rowField, index) => {
          // For a newly-enabled agent (no baseline def) every field reads as modified.
          const modified =
            baselineDef === undefined ||
            !valuesEqual(fields[rowField.key], baselineFields[rowField.key]);
          return (
            <TextField
              key={rowField.key}
              label={rowField.label}
              value={fields[rowField.key]}
              placeholder={
                rowField.key === "sandboxAgent" && sandboxRequired
                  ? "required for runner: sdx"
                  : rowField.placeholder
              }
              isActive={active === index}
              modified={modified}
              onChange={(v) => {
                guard.markDirty();
                setFields((f) => ({ ...f, [rowField.key]: v }));
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
