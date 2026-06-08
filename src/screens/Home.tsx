import { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  SECTION_LABEL,
  SECTION_ORDER,
  sectionSummary,
  type SectionId,
} from "../domain/sections.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  issues: Set<SectionId>;
  onOpen: (id: SectionId) => void;
}

export function Home({ draft, issues, onOpen }: Props) {
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.downArrow)
      setCursor((c) => Math.min(SECTION_ORDER.length - 1, c + 1));
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.return) {
      const id = SECTION_ORDER[cursor];
      if (id) onOpen(id);
    }
  });

  return (
    <Box flexDirection="column">
      {SECTION_ORDER.map((id, index) => {
        const bad = issues.has(id);
        return (
          <Box key={id}>
            <Text color={cursor === index ? "cyan" : undefined}>
              {cursor === index ? "▸ " : "  "}
            </Text>
            <Box width={16}>
              <Text color={cursor === index ? "cyan" : undefined}>
                {SECTION_LABEL[id]}
              </Text>
            </Box>
            <Text color={bad ? "yellow" : "green"}>{bad ? "⚠" : "✓"} </Text>
            <Text dimColor>{sectionSummary(id, draft)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
