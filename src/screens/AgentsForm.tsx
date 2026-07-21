import { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  BUILTIN_AGENTS,
  getAgentDef,
  isAgentEnabled,
  runnerRequiresSandbox,
  setAgentDef,
  setAgentEnabled,
} from "../domain/agents.ts";
import { valuesEqual } from "../domain/diff.ts";
import { isBypassEnabled, setBypass } from "../domain/permissions.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { AgentSubForm } from "./AgentSubForm.tsx";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// A focusable row: enable a built-in agent, open its Configure sub-editor, or
// toggle claude's bypass sub-option.
type Row =
  | { kind: "enable"; name: (typeof BUILTIN_AGENTS)[number] }
  | { kind: "configure"; name: (typeof BUILTIN_AGENTS)[number] }
  | { kind: "bypass" };

// Section editor for the coding agents groundcrew runs: enable/disable each
// built-in (claude, codex, cursor), toggle claude's permission-bypass child row,
// and edit per-agent fields via AgentSubForm. Follows the screen contract — see
// SectionForm.
export function AgentsForm({ draft, baseline, onChange, onBack }: Props) {
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState<string | undefined>(undefined);

  const agents = draft.agents ?? {};
  const definitions = agents.definitions ?? {};
  const baseAgents = baseline.agents ?? {};
  const baseDefinitions = baseAgents.definitions ?? {};
  const claudeOn = isAgentEnabled(agents, "claude");
  const sandboxRequired = runnerRequiresSandbox(draft.local?.runner);

  // For each built-in: enable row, then a Configure row so the sub-editor is
  // discoverable without needing to know that Enter on the checkbox opens it.
  // claude additionally gets a bypass toggle when enabled. Model-variant presets
  // such as cursor-grok are config-only built-ins and appear in the
  // custom-agents list when enabled.
  const rows: Row[] = [];
  for (const name of BUILTIN_AGENTS) {
    rows.push({ kind: "enable", name });
    rows.push({ kind: "configure", name });
    if (name === "claude" && claudeOn) rows.push({ kind: "bypass" });
  }
  const focused = Math.min(cursor, rows.length - 1);

  const custom = Object.keys(definitions).filter(
    (name) => !(BUILTIN_AGENTS as readonly string[]).includes(name),
  );

  function toggle(row: Extract<Row, { kind: "enable" | "bypass" }>): void {
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
      if (row?.kind === "enable" || row?.kind === "configure") setEditing(row.name);
      return;
    }
    if (key.downArrow) setCursor(Math.min(rows.length - 1, focused + 1));
    if (key.upArrow) setCursor(Math.max(0, focused - 1));
    if (input === " ") {
      const row = rows[focused];
      if (row?.kind === "enable" || row?.kind === "bypass") toggle(row);
    }
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    return (
      <AgentSubForm
        name={editing}
        def={getAgentDef(agents, editing)}
        baselineDef={
          Object.hasOwn(baseDefinitions, editing)
            ? getAgentDef(baseAgents, editing)
            : undefined
        }
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
            const baseOn = isAgentEnabled(baseAgents, row.name);
            const modified =
              on !== baseOn ||
              !valuesEqual(definitions[row.name], baseDefinitions[row.name]);
            return (
              <Text key={row.name} color={active ? "cyan" : undefined}>
                {marker}
                <Text color={on ? "green" : undefined}>[{on ? "x" : " "}]</Text>{" "}
                {row.name}
                {modified ? <Text color="yellow"> ●</Text> : null}
              </Text>
            );
          }
          if (row.kind === "configure") {
            return (
              <Text key={`configure-${row.name}`} color={active ? "cyan" : undefined}>
                {marker}
                {"    "}
                › Configure fields…
              </Text>
            );
          }
          const on = isBypassEnabled("claude", definitions.claude);
          const baseBypass = isBypassEnabled("claude", baseDefinitions.claude);
          const modified = on !== baseBypass;
          return (
            <Text key="bypass" color={active ? "cyan" : undefined}>
              {marker}
              {"    "}
              <Text color={on ? "green" : undefined}>[{on ? "x" : " "}]</Text>{" "}
              bypass permission prompts
              {modified ? <Text color="yellow"> ●</Text> : null}
            </Text>
          );
        })}
      </Box>
      {custom.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {custom.map((name) => (
            <Text key={name} dimColor>
              {name} — defined in crew.config.json
            </Text>
          ))}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          The AI coding tools groundcrew runs on your tasks (e.g. Claude,
          Codex, Cursor). Check the ones installed on your machine. "bypass
          permission prompts" lets the agent act without stopping to ask. ↑/↓
          move · space toggle checkbox · enter open Configure · esc back.
        </Text>
      </Box>
    </Box>
  );
}
