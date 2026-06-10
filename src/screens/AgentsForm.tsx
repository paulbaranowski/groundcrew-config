import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import {
  BUILTIN_AGENTS,
  getAgentDef,
  isAgentEnabled,
  runnerRequiresSandbox,
  setAgentDef,
  setAgentEnabled,
} from "../domain/agents.ts";
import { isBypassEnabled, setBypass } from "../domain/permissions.ts";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { editJson } from "../io/editJson.ts";
import { AgentSubForm } from "./AgentSubForm.tsx";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// A focusable row: enable a built-in agent, or toggle claude's bypass sub-option.
type Row =
  | { kind: "enable"; name: (typeof BUILTIN_AGENTS)[number] }
  | { kind: "bypass" };

export function AgentsForm({ draft, onChange, onBack }: Props) {
  const { setRawMode } = useStdin();
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  // editJson runs async; guard against the tree unmounting before it resolves.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const agents = draft.agents ?? {};
  const definitions = agents.definitions ?? {};
  const claudeOn = isAgentEnabled(agents, "claude");
  const sandboxRequired = runnerRequiresSandbox(draft.local?.runner);

  // claude → (bypass when claude on) → codex. The bypass row is a child of claude.
  const rows: Row[] = [];
  rows.push({ kind: "enable", name: "claude" });
  if (claudeOn) rows.push({ kind: "bypass" });
  rows.push({ kind: "enable", name: "codex" });
  const focused = Math.min(cursor, rows.length - 1);

  const custom = Object.keys(definitions).filter(
    (name) => !BUILTIN_AGENTS.includes(name as never),
  );

  function toggle(row: Row): void {
    if (row.kind === "enable") {
      onChange({
        ...draft,
        agents: setAgentEnabled(agents, row.name, !isAgentEnabled(agents, row.name)),
      });
    } else {
      onChange({
        ...draft,
        agents: setBypass(agents, "claude", !isBypassEnabled("claude", definitions.claude)),
      });
    }
  }

  useInput(
    (input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      const row = rows[focused];
      if (row?.kind === "enable") setEditing(row.name);
      return;
    }
    if (input === "e") {
      // Release Ink's hold on stdin so $EDITOR owns the terminal.
      setRawMode(false);
      void editJson(agents).then((result) => {
        if (!mountedRef.current) return;
        setRawMode(true);
        if (result.ok) {
          setError(undefined);
          onChange(
            setByPath(
              draft as unknown as Record<string, unknown>,
              "agents",
              result.value,
            ) as unknown as ConfigDraft,
          );
        } else setError(result.error);
      });
      return;
    }
    if (key.downArrow) setCursor(Math.min(rows.length - 1, focused + 1));
    if (key.upArrow) setCursor(Math.max(0, focused - 1));
    if (input === " ") {
      const row = rows[focused];
      if (row) toggle(row);
    }
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    return (
      <AgentSubForm
        name={editing}
        def={getAgentDef(agents, editing)}
        sandboxRequired={sandboxRequired}
        onSave={(def) => {
          onChange({ ...draft, agents: setAgentDef(agents, editing, def) });
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Agents</Text>
      <Box marginTop={1} flexDirection="column">
        {rows.map((row, index) => {
          const active = index === focused;
          const marker = active ? "▸ " : "  ";
          if (row.kind === "enable") {
            const on = isAgentEnabled(agents, row.name);
            return (
              <Text key={row.name} color={active ? "cyan" : undefined}>
                {marker}
                <Text color={on ? "green" : undefined}>[{on ? "x" : " "}]</Text>{" "}
                {row.name}
              </Text>
            );
          }
          const on = isBypassEnabled("claude", definitions.claude);
          return (
            <Text key="bypass" color={active ? "cyan" : undefined}>
              {marker}
              {"    "}
              <Text color={on ? "green" : undefined}>[{on ? "x" : " "}]</Text>{" "}
              bypass permission prompts
            </Text>
          );
        })}
      </Box>
      {custom.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {custom.map((name) => (
            <Text key={name} dimColor>
              {name} — edit via raw JSON
            </Text>
          ))}
        </Box>
      ) : null}
      {error ? (
        <Box marginTop={1}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          The AI coding tools groundcrew runs on your tickets (e.g. Claude,
          Codex). Check the ones installed on your machine. "bypass permission
          prompts" lets the agent act without stopping to ask. ↑/↓ move · space
          toggle · enter edit fields · e edit raw JSON · esc back.
        </Text>
      </Box>
    </Box>
  );
}
