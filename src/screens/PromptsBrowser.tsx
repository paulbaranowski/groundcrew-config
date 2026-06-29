// Two-mode screen for the packaged-prompts catalog:
//   list   — pick a prompt; shows title + description per row, no body preview
//   reader — read the prompt body with scroll; `i` installs, esc returns to list
// Install writes the prompt next to crew.config.json and updates the draft.

import { useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { installPrompt } from "../prompts/install.ts";
import {
  listPackagedPrompts,
  type PackagedPrompt,
} from "../prompts/loader.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { PromptsReader } from "./PromptsReader.tsx";

interface Props {
  draft: ConfigDraft;
  configDir: string;
  onInstalled: (next: ConfigDraft, relativePath: string) => void;
  onBack: () => void;
}

type Mode = "list" | "reader";

export function PromptsBrowser({
  draft,
  configDir,
  onInstalled,
  onBack,
}: Props) {
  // listPackagedPrompts hits the filesystem; memoize so navigation between
  // entries doesn't re-read every render.
  const { prompts, error: listError } = useMemo(() => safeList(), []);
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [mode, setMode] = useState<Mode>("list");
  const [error, setError] = useState<string | undefined>(undefined);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  function install(prompt: PackagedPrompt): void {
    try {
      const result = installPrompt(draft, configDir, prompt);
      onInstalled(result.draft, result.relativePath);
    } catch (e) {
      setError((e as Error).message);
      setMode("list");
    }
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack();
        return;
      }
      if (prompts.length === 0) return;
      if (key.downArrow)
        moveCursor(Math.min(prompts.length - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return || input === "v") setMode("reader");
      if (input === "i") {
        const focused = prompts[cursorRef.current];
        if (focused) install(focused);
      }
    },
    { isActive: mode === "list" },
  );

  if (mode === "reader") {
    const focused = prompts[cursor];
    // Defensive: should be unreachable since Enter is gated on prompts.length>0,
    // but typescript can't prove cursor stays in bounds.
    if (!focused) {
      setMode("list");
      return null;
    }
    return (
      <PromptsReader
        prompt={focused}
        onInstall={() => install(focused)}
        onBack={() => setMode("list")}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Packaged prompts</Text>
      {listError ? (
        <Box marginTop={1}>
          <Text color="red">Could not load packaged prompts: {listError}</Text>
        </Box>
      ) : prompts.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No packaged prompts found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {prompts.map((p, index) => (
            <Box key={p.slug} flexDirection="column" marginBottom={1}>
              <Text color={cursor === index ? "cyan" : undefined}>
                {cursor === index ? "▸ " : "  "}
                <Text bold>{p.title}</Text>
              </Text>
              {p.description ? (
                <Box marginLeft={2}>
                  <Text dimColor>{p.description}</Text>
                </Box>
              ) : null}
            </Box>
          ))}
        </Box>
      )}
      {error ? (
        <Box marginTop={1}>
          <Text color="red">Install failed: {error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Each entry is a pre-written initial prompt. Installing one writes it
          under {configDir}/prompts/ and points promptFile at it.
        </Text>
        <Text dimColor>↑/↓ select · i install · v/enter view · esc back</Text>
      </Box>
    </Box>
  );
}

function safeList(): { prompts: PackagedPrompt[]; error?: string } {
  try {
    return { prompts: listPackagedPrompts() };
  } catch (e) {
    // ENOENT on the packaged-prompts dir is expected in some dev/test contexts
    // (e.g. running against a partial dist) — fall back to the "no prompts found"
    // hint. Anything else (malformed frontmatter, EACCES, corrupt copy) is a
    // real problem and should surface, not silently render as empty.
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { prompts: [] };
    return { prompts: [], error: err.message };
  }
}
