import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import {
  applyAgentFields,
  readAgentFields,
  type AgentFields,
} from "../domain/agents.ts";

type Def = Record<string, unknown>;

interface Props {
  name: string;
  def: Def;
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

export function AgentSubForm({ name, def, sandboxRequired, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<AgentFields>(() => readAgentFields(def));
  const [active, setActive] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onCancel();
    if (key.downArrow) setActive((a) => Math.min(ROWS.length - 1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
    if (key.return) onSave(applyAgentFields(def, fields));
  });

  const sandboxMissing = sandboxRequired && fields.sandboxAgent.trim().length === 0;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Agent: {name}</Text>
      <Box flexDirection="column" marginTop={1}>
        {ROWS.map((rowField, index) => (
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
            onChange={(v) => setFields((f) => ({ ...f, [rowField.key]: v }))}
          />
        ))}
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
          ↑/↓ move · type to edit · enter save · esc cancel. Blank fields inherit
          the built-in preset / are omitted.
        </Text>
      </Box>
    </Box>
  );
}
