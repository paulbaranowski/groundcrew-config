// Bespoke screen for the Prompts section. Hosts the two existing text fields
// (`initial`, `promptFile`) plus a third menu row that opens PromptsBrowser
// for installing one of the packaged prompts.

import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import { getByPath, setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { PromptsBrowser } from "./PromptsBrowser.tsx";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
  configDir: string;
}

type Mode = "form" | "browse";
const ROW_COUNT = 3;
const INITIAL_ROW = 0;
const PROMPT_FILE_ROW = 1;
const BROWSE_ROW = 2;

function asString(value: unknown): string {
  return value === undefined ? "" : String(value);
}

export function PromptsScreen({ draft, onChange, onBack, configDir }: Props) {
  const [mode, setMode] = useState<Mode>("form");
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [installed, setInstalled] = useState<string | undefined>(undefined);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput(
    (_input, key) => {
      if (mode !== "form") return;
      if (key.escape) {
        onBack();
        return;
      }
      if (key.downArrow)
        moveCursor(Math.min(ROW_COUNT - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return && cursorRef.current === BROWSE_ROW) setMode("browse");
    },
    { isActive: mode === "form" },
  );

  function update(path: string, raw: string): void {
    const value = raw.length === 0 ? undefined : raw;
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        path,
        value,
      ) as unknown as ConfigDraft,
    );
  }

  if (mode === "browse") {
    return (
      <PromptsBrowser
        draft={draft}
        configDir={configDir}
        onInstalled={(next, relativePath) => {
          onChange(next);
          setInstalled(relativePath);
          setMode("form");
          setCursor(PROMPT_FILE_ROW);
        }}
        onBack={() => setMode("form")}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Prompts</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="initial"
          value={asString(getByPath(draft, "prompts.initial"))}
          isActive={cursor === INITIAL_ROW}
          onChange={(v) => update("prompts.initial", v)}
        />
        <TextField
          label="promptFile"
          value={asString(getByPath(draft, "prompts.promptFile"))}
          isActive={cursor === PROMPT_FILE_ROW}
          onChange={(v) => update("prompts.promptFile", v)}
        />
        <Box>
          <Text color={cursor === BROWSE_ROW ? "cyan" : undefined}>
            {cursor === BROWSE_ROW ? "› " : "  "}
            Browse packaged prompts →
          </Text>
        </Box>
      </Box>
      {installed ? (
        <Box marginTop={1}>
          <Text color="green">
            Installed → promptFile = {installed}
          </Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          The instructions groundcrew gives the agent at the start of every
          task. `initial` and `promptFile` are mutually exclusive — installing a
          packaged prompt sets `promptFile` and clears `initial`.
        </Text>
        <Text dimColor>↑/↓ move · type to edit · enter on browse · esc back</Text>
      </Box>
    </Box>
  );
}
