// Full-screen reader for one packaged prompt. Scrolls the body line-by-line
// (↑/↓) or by page (space / b, also pageUp/pageDown), and exposes `i` to
// install the prompt. Esc returns to the browser list.

import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useFullscreen } from "../hooks/useFullscreen.ts";
import type { PackagedPrompt } from "../prompts/loader.ts";

interface Props {
  prompt: PackagedPrompt;
  onInstall: () => void;
  onBack: () => void;
}

// Rows reserved for the screen's chrome (border, title, description, scroll
// indicators, footer help). Subtracted from terminal height to figure out how
// many body lines fit. A conservative value — better to render one extra
// "↓ N more" line than to clip the last visible body line off-screen.
const CHROME_ROWS = 8;
const MIN_VISIBLE = 4;

export function PromptsReader({ prompt, onInstall, onBack }: Props) {
  const { rows: terminalRows } = useFullscreen();
  const lines = prompt.body.split("\n");
  const visible = Math.max(MIN_VISIBLE, terminalRows - CHROME_ROWS);
  const maxTop = Math.max(0, lines.length - visible);

  // Same stale-closure pattern other screens use (TaskSourcesMenu, PromptsScreen)
  // — keypress bursts otherwise compose on the render-time `scrollTop` and
  // single-line moves swallow page jumps.
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(0);
  function moveScroll(next: number): void {
    const clamped = Math.max(0, Math.min(maxTop, next));
    scrollRef.current = clamped;
    setScrollTop(clamped);
  }

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "i") {
      onInstall();
      return;
    }
    if (key.downArrow) moveScroll(scrollRef.current + 1);
    if (key.upArrow) moveScroll(scrollRef.current - 1);
    if (key.pageDown || input === " ") moveScroll(scrollRef.current + visible);
    if (key.pageUp || input === "b") moveScroll(scrollRef.current - visible);
    if (input === "g") moveScroll(0);
    if (input === "G") moveScroll(maxTop);
  });

  const end = Math.min(lines.length, scrollTop + visible);
  const above = scrollTop;
  const below = lines.length - end;
  const slice = lines.slice(scrollTop, end);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{prompt.title}</Text>
      {prompt.description ? (
        <Box marginTop={1}>
          <Text dimColor>{prompt.description}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        {above > 0 ? <Text dimColor>{`↑ ${above} more line${above === 1 ? "" : "s"}`}</Text> : null}
        {slice.map((line, index) => (
          <Text key={scrollTop + index}>{line === "" ? " " : line}</Text>
        ))}
        {below > 0 ? <Text dimColor>{`↓ ${below} more line${below === 1 ? "" : "s"}`}</Text> : null}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ scroll · space/b page · g/G top/bottom · i install · esc back
        </Text>
      </Box>
    </Box>
  );
}
