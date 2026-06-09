import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import {
  isBypassEnabled,
  isClaudeModel,
  setBypass,
} from "../domain/permissions.ts";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { editJson } from "../io/editJson.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

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
  const entries = Object.entries(models.definitions ?? {});
  const claudeModels = entries.filter(([name, def]) => isClaudeModel(name, def));
  const otherModels = entries.filter(([name, def]) => !isClaudeModel(name, def));
  const focused = Math.min(cursor, Math.max(0, claudeModels.length - 1));

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
    if (claudeModels.length === 0) return;
    if (key.downArrow) setCursor(Math.min(claudeModels.length - 1, focused + 1));
    if (key.upArrow) setCursor(Math.max(0, focused - 1));
    if (input === " ") {
      const entry = claudeModels[focused];
      if (!entry) return;
      const [name, def] = entry;
      onChange({
        ...draft,
        models: setBypass(models, name, !isBypassEnabled(name, def)),
      });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Models</Text>
      <Box marginTop={1} flexDirection="column">
        {claudeModels.length === 0 ? (
          <Text dimColor>(no claude models to toggle — add one via raw JSON)</Text>
        ) : (
          claudeModels.map(([name, def], index) => {
            const on = isBypassEnabled(name, def);
            const active = index === focused;
            return (
              <Text key={name} color={active ? "cyan" : undefined}>
                {active ? "▸ " : "  "}
                <Text color={on ? "green" : undefined}>[{on ? "x" : " "}]</Text>{" "}
                {name} — bypass permission prompts
              </Text>
            );
          })
        )}
      </Box>
      {otherModels.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {otherModels.map(([name]) => (
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
          {claudeModels.length > 1 ? "↑/↓ move · " : ""}space toggle · e edit raw
          JSON · esc back
        </Text>
      </Box>
    </Box>
  );
}
