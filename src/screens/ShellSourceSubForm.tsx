import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import {
  applyShellFields,
  readShellFields,
  type ShellFields,
  type ShellTextField,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { ShellEnvEditor } from "./ShellEnvEditor.tsx";

type Source = NonNullable<ConfigDraft["sources"]>[number];

interface Props {
  source: Source | undefined;
  onSave: (source: Source) => void;
  onCancel: () => void;
}

const ROWS: Array<{ key: ShellTextField; label: string; placeholder: string }> = [
  { key: "name", label: "name", placeholder: "kebab-case, e.g. jira" },
  { key: "verify", label: "commands.verify", placeholder: "connectivity check (optional)" },
  { key: "validate", label: "commands.validate", placeholder: "emit JSON array of config error strings (optional)" },
  { key: "listTasks", label: "commands.listTasks", placeholder: "emit ShellIssue[] JSON (required)" },
  { key: "getTask", label: "commands.getTask", placeholder: "emit one ShellIssue for ${id}" },
  { key: "createTask", label: "commands.createTask", placeholder: "create from ${title}/${description}, emit the new ShellIssue (optional)" },
  { key: "markInProgress", label: "commands.markInProgress", placeholder: "move ${id} in-progress" },
  { key: "markInReview", label: "commands.markInReview", placeholder: "move ${id} in-review" },
  { key: "markDone", label: "commands.markDone", placeholder: "move ${id} done" },
  { key: "cwd", label: "cwd", placeholder: "working dir for commands (optional)" },
];

// The env summary sits one past the text rows; entering it opens the env editor
// instead of saving. So the navigable range is [0, ROWS.length], not ROWS.length-1.
const ENV_ROW = ROWS.length;

export function ShellSourceSubForm({ source, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<ShellFields>(() => readShellFields(source));
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"fields" | "env">("fields");
  // Mirror the active row in a ref so a burst of keypresses in one render (each
  // useInput call shares a stale `active` closure until React re-renders) still
  // branches enter on the latest row — the same trick ListField uses.
  const activeRef = useRef(0);

  function moveActive(next: number): void {
    activeRef.current = next;
    setActive(next);
  }

  useInput(
    (_input, key) => {
      if (key.escape) onCancel();
      if (key.downArrow) moveActive(Math.min(ENV_ROW, activeRef.current + 1));
      if (key.upArrow) moveActive(Math.max(0, activeRef.current - 1));
      if (key.return) {
        if (activeRef.current === ENV_ROW) setMode("env");
        else onSave(applyShellFields(source, fields));
      }
    },
    { isActive: mode === "fields" },
  );

  if (mode === "env") {
    return (
      <ShellEnvEditor
        env={fields.env}
        onChange={(env) => setFields((f) => ({ ...f, env }))}
        onBack={() => setMode("fields")}
      />
    );
  }

  const nameMissing = fields.name.trim().length === 0;
  const listTasksMissing = fields.listTasks.trim().length === 0;
  const envActive = active === ENV_ROW;
  const envCount = fields.env.length;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Shell source</Text>
      <Box flexDirection="column" marginTop={1}>
        {ROWS.map((row, index) => (
          <TextField
            key={row.key}
            label={row.label}
            value={fields[row.key]}
            placeholder={row.placeholder}
            isActive={active === index}
            onChange={(v) => setFields((f) => ({ ...f, [row.key]: v }))}
          />
        ))}
        <Box>
          <Text color={envActive ? "cyan" : undefined}>
            {envActive ? "› " : "  "}env{" "}
          </Text>
          <Text dimColor>
            {envCount} variable{envCount === 1 ? "" : "s"} — enter to edit
          </Text>
        </Box>
      </Box>
      {nameMissing || listTasksMissing ? (
        <Box marginTop={1} flexDirection="column">
          {nameMissing ? (
            <Text color="yellow">⚠ name is required (kebab-case).</Text>
          ) : null}
          {listTasksMissing ? (
            <Text color="yellow">
              ⚠ commands.listTasks is required (or the legacy fetch alias).
            </Text>
          ) : null}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          Commands groundcrew runs to talk to your tracker. listTasks is required;{" "}
          {"${id}"} is filled in per task. ↑/↓ move · type to edit · enter save ·
          esc cancel.
        </Text>
      </Box>
    </Box>
  );
}
