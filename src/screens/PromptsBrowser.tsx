// Lists the packaged prompts on the left, previews the focused one on the
// right. Enter installs the focused prompt (writes it next to crew.config.json
// and updates the draft); esc returns to the Prompts screen.

import { useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { installPrompt } from "../prompts/install.ts";
import {
  listPackagedPrompts,
  type PackagedPrompt,
} from "../prompts/loader.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  configDir: string;
  onInstalled: (next: ConfigDraft, relativePath: string) => void;
  onBack: () => void;
}

const PREVIEW_LINES = 18;

export function PromptsBrowser({
  draft,
  configDir,
  onInstalled,
  onBack,
}: Props) {
  // listPackagedPrompts hits the filesystem; memoize so navigation between
  // entries doesn't re-read every render.
  const prompts = useMemo(() => safeList(), []);
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [error, setError] = useState<string | undefined>(undefined);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (prompts.length === 0) return;
    if (key.downArrow)
      moveCursor(Math.min(prompts.length - 1, cursorRef.current + 1));
    if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
    if (key.return) {
      const focused = prompts[cursorRef.current];
      if (!focused) return;
      try {
        const result = installPrompt(draft, configDir, focused);
        onInstalled(result.draft, result.relativePath);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  });

  const focused = prompts[cursor];

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Packaged prompts</Text>
      {prompts.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No packaged prompts found.</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Box flexDirection="column" width={28} marginRight={2}>
            {prompts.map((p, index) => (
              <Box key={p.slug}>
                <Text color={cursor === index ? "cyan" : undefined}>
                  {cursor === index ? "▸ " : "  "}
                  {p.title}
                </Text>
              </Box>
            ))}
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            {focused ? <Preview prompt={focused} /> : null}
          </Box>
        </Box>
      )}
      {error ? (
        <Box marginTop={1}>
          <Text color="red">Install failed: {error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Each entry is a pre-written initial prompt. Enter installs it under
          <Text> </Text>
          {configDir}
          <Text>/prompts/ and points </Text>
          promptFile<Text> at it.</Text>
        </Text>
        <Text dimColor>↑/↓ select · enter install · esc back</Text>
      </Box>
    </Box>
  );
}

function Preview({ prompt }: { prompt: PackagedPrompt }) {
  const lines = prompt.body.split("\n");
  const shown = lines.slice(0, PREVIEW_LINES);
  const overflow = lines.length - shown.length;
  return (
    <Box flexDirection="column">
      {prompt.description ? (
        <Box marginBottom={1}>
          <Text>{prompt.description}</Text>
        </Box>
      ) : null}
      {shown.map((line, index) => (
        <Text key={index} dimColor>
          {line === "" ? " " : line}
        </Text>
      ))}
      {overflow > 0 ? (
        <Text dimColor>… {overflow} more line{overflow === 1 ? "" : "s"}</Text>
      ) : null}
    </Box>
  );
}

function safeList(): PackagedPrompt[] {
  try {
    return listPackagedPrompts();
  } catch {
    // The packaged-prompts dir is missing in some dev/test contexts. The empty
    // list is rendered with a "no prompts found" hint above.
    return [];
  }
}
