import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import {
  applyShellFields,
  readShellFields,
  type ShellFields,
  type ShellSource,
  type ShellTextField,
} from "../domain/sources.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { ShellEnvEditor } from "./ShellEnvEditor.tsx";
import { ShellSandboxPathsEditor } from "./ShellSandboxPathsEditor.tsx";
import { SaveGuard } from "./SaveGuard.tsx";

interface Props {
  source: ShellSource | undefined;
  /** The matched baseline source; undefined for a newly-added source. */
  baselineSource: ShellSource | undefined;
  onSave: (source: ShellSource) => void;
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

// The env summary sits one past the text rows; the sandbox-paths summary one
// past that. Both rows open a nested editor on enter instead of saving, so the
// navigable range is [0, SANDBOX_ROW], not ROWS.length-1.
const ENV_ROW = ROWS.length;
const SANDBOX_ROW = ENV_ROW + 1;

// Buffered sub-editor for one shell source: edits the name/commands/cwd rows plus
// a nested env editor locally, committing via `onSave` only on enter (esc routes
// through the edit guard). Owned by ShellSourcesForm, not a top-level screen.
export function ShellSourceSubForm({
  source,
  baselineSource,
  onSave,
  onCancel,
}: Props) {
  const [fields, setFields] = useState<ShellFields>(() => readShellFields(source));
  const baselineFields = readShellFields(baselineSource);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"fields" | "env" | "paths">("fields");
  const guard = useEditGuard();
  // Mirror the active row in a ref so a burst of keypresses in one render (each
  // useInput call shares a stale `active` closure until React re-renders) still
  // branches enter on the latest row — the same trick ListField uses. The
  // useInput handler MUST read `activeRef.current`, never the render-time
  // `active` state, or a fast ↑/↓-then-enter branches on the pre-burst row. Do
  // not "simplify" the ref away.
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
      if (key.downArrow) moveActive(Math.min(SANDBOX_ROW, activeRef.current + 1));
      if (key.upArrow) moveActive(Math.max(0, activeRef.current - 1));
      if (key.return) {
        if (activeRef.current === ENV_ROW) setMode("env");
        else if (activeRef.current === SANDBOX_ROW) setMode("paths");
        else onSave(applyShellFields(source, fields));
      }
    },
    { isActive: mode === "fields" && !guard.guarding },
  );

  if (guard.guarding) {
    return (
      <SaveGuard
        onApply={() => onSave(applyShellFields(source, fields))}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  if (mode === "env") {
    return (
      <ShellEnvEditor
        env={fields.env}
        baselineEnv={baselineFields.env}
        onChange={(env) => {
          guard.markDirty();
          setFields((f) => ({ ...f, env }));
        }}
        onBack={() => setMode("fields")}
      />
    );
  }

  if (mode === "paths") {
    return (
      <ShellSandboxPathsEditor
        paths={fields.sandboxWritePaths}
        baselinePaths={baselineFields.sandboxWritePaths}
        onChange={(sandboxWritePaths) => {
          guard.markDirty();
          setFields((f) => ({ ...f, sandboxWritePaths }));
        }}
        onBack={() => setMode("fields")}
      />
    );
  }

  const nameMissing = fields.name.trim().length === 0;
  const listTasksMissing = fields.listTasks.trim().length === 0;
  const envActive = active === ENV_ROW;
  const envCount = fields.env.length;
  const pathsActive = active === SANDBOX_ROW;
  const pathsCount = fields.sandboxWritePaths.length;
  // For a newly-added source (no matching baseline) every field reads as modified.
  const envModified =
    baselineSource === undefined ||
    !valuesEqual(fields.env, baselineFields.env);
  const pathsModified =
    baselineSource === undefined ||
    !valuesEqual(fields.sandboxWritePaths, baselineFields.sandboxWritePaths);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Shell source</Text>
      <Box flexDirection="column" marginTop={1}>
        {ROWS.map((row, index) => {
          const modified =
            baselineSource === undefined ||
            !valuesEqual(fields[row.key], baselineFields[row.key]);
          return (
            <TextField
              key={row.key}
              label={row.label}
              value={fields[row.key]}
              placeholder={row.placeholder}
              isActive={active === index}
              modified={modified}
              onChange={(v) => {
                guard.markDirty();
                setFields((f) => ({ ...f, [row.key]: v }));
              }}
            />
          );
        })}
        <Box>
          <Text color={envActive ? "cyan" : undefined}>
            {envActive ? "› " : "  "}env{" "}
          </Text>
          <Text dimColor>
            {envCount} variable{envCount === 1 ? "" : "s"} — enter to edit
          </Text>
          {envModified ? <Text color="yellow"> ●</Text> : null}
        </Box>
        <Box>
          <Text color={pathsActive ? "cyan" : undefined}>
            {pathsActive ? "› " : "  "}sandboxWritePaths{" "}
          </Text>
          <Text dimColor>
            {pathsCount} path{pathsCount === 1 ? "" : "s"} — enter to edit
          </Text>
          {pathsModified ? <Text color="yellow"> ●</Text> : null}
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
          {"${id}"} is filled in per task. ↑/↓ move · type to edit · enter apply ·
          esc cancel.
        </Text>
      </Box>
    </Box>
  );
}
