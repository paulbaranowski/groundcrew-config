import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { BUILTIN_MODELS, isModelEnabled, setModelEnabled } from "../domain/models.ts";
import { isBypassEnabled, setBypass } from "../domain/permissions.ts";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { editJson } from "../io/editJson.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// A focusable row: enable a built-in model, or toggle claude's bypass sub-option.
type Row =
  | { kind: "enable"; name: (typeof BUILTIN_MODELS)[number] }
  | { kind: "bypass" };

export function ModelsForm({ draft, onChange, onBack }: Props) {
  const { setRawMode } = useStdin();
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  // editJson runs async; guard against the tree unmounting before it resolves.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const models = draft.models ?? {};
  const definitions = models.definitions ?? {};
  const claudeOn = isModelEnabled(models, "claude");

  // claude → (bypass when claude on) → codex. The bypass row is a child of claude.
  const rows: Row[] = [];
  rows.push({ kind: "enable", name: "claude" });
  if (claudeOn) rows.push({ kind: "bypass" });
  rows.push({ kind: "enable", name: "codex" });
  const focused = Math.min(cursor, rows.length - 1);

  const custom = Object.keys(definitions).filter(
    (name) => !BUILTIN_MODELS.includes(name as never),
  );

  function toggle(row: Row): void {
    if (row.kind === "enable") {
      onChange({
        ...draft,
        models: setModelEnabled(models, row.name, !isModelEnabled(models, row.name)),
      });
    } else {
      onChange({
        ...draft,
        models: setBypass(models, "claude", !isBypassEnabled("claude", definitions.claude)),
      });
    }
  }

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "e") {
      // Release Ink's hold on stdin so $EDITOR owns the terminal.
      setRawMode(false);
      void editJson(models).then((result) => {
        if (!mountedRef.current) return;
        setRawMode(true);
        if (result.ok) {
          setError(undefined);
          onChange(
            setByPath(
              draft as unknown as Record<string, unknown>,
              "models",
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
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Models</Text>
      <Box marginTop={1} flexDirection="column">
        {rows.map((row, index) => {
          const active = index === focused;
          const marker = active ? "▸ " : "  ";
          if (row.kind === "enable") {
            const on = isModelEnabled(models, row.name);
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
        <Text dimColor>↑/↓ move · space toggle · e edit raw JSON · esc back</Text>
      </Box>
    </Box>
  );
}
