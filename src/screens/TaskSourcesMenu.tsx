import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  shellSourceCount,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { LinearForm } from "./LinearForm.tsx";
import { PlanKeeperForm } from "./PlanKeeperForm.tsx";
import { ShellSourcesForm } from "./ShellSourcesForm.tsx";
import { TodoTxtForm } from "./TodoTxtForm.tsx";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

type Sub = "hub" | "linear" | "todoTxt" | "planKeeper" | "shell";
const ROWS: Array<Exclude<Sub, "hub">> = [
  "linear",
  "todoTxt",
  "planKeeper",
  "shell",
];

/**
 * Hub for the taskSources section: owns sub-routing to LinearForm, TodoTxtForm,
 * PlanKeeperForm, and ShellSourcesForm via its `Sub` union and `ROWS`. To add a
 * task-source screen, extend `Sub`/`ROWS` and the dispatch here — not app.tsx,
 * which only routes the `taskSources` SectionId to this hub.
 */
export function TaskSourcesMenu({ draft, onChange, onBack }: Props) {
  const [sub, setSub] = useState<Sub>("hub");
  const [cursor, setCursor] = useState(0);
  // Mirror the cursor in a ref so a down+enter burst in one render opens the
  // latest row (the handler otherwise closes over a stale cursor).
  const cursorRef = useRef(0);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput(
    (_input, key) => {
      if (sub !== "hub") return;
      if (key.escape) onBack();
      if (key.downArrow)
        moveCursor(Math.min(ROWS.length - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) {
        const next = ROWS[cursorRef.current];
        if (next) setSub(next);
      }
    },
    { isActive: sub === "hub" },
  );

  const back = () => setSub("hub");

  if (sub === "linear")
    return <LinearForm draft={draft} onChange={onChange} onBack={back} />;
  if (sub === "todoTxt")
    return <TodoTxtForm draft={draft} onChange={onChange} onBack={back} />;
  if (sub === "planKeeper")
    return <PlanKeeperForm draft={draft} onChange={onChange} onBack={back} />;
  if (sub === "shell")
    return <ShellSourcesForm draft={draft} onChange={onChange} onBack={back} />;

  const rows: Array<{ id: Sub; label: string; status: string }> = [
    {
      id: "linear",
      label: "Linear",
      status: isLinearEnabled(draft) ? "enabled" : "disabled",
    },
    {
      id: "todoTxt",
      label: "todo-txt",
      status: isTodoTxtEnabled(draft) ? "enabled" : "disabled",
    },
    {
      id: "planKeeper",
      label: "PlanKeeper",
      status: isPlanKeeperEnabled(draft) ? "enabled" : "disabled",
    },
    {
      id: "shell",
      label: "Shell sources",
      status: `${shellSourceCount(draft)} source(s)`,
    },
  ];

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Task Sources</Text>
      <Box marginTop={1} flexDirection="column">
        {rows.map((row, index) => (
          <Box key={row.id}>
            <Text color={cursor === index ? "cyan" : undefined}>
              {cursor === index ? "▸ " : "  "}
            </Text>
            <Box width={20}>
              <Text color={cursor === index ? "cyan" : undefined}>
                {row.label}
              </Text>
            </Box>
            <Text dimColor>{row.status}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Where groundcrew gets its to-do list. Turn on one or more sources of
          tasks for it to work through. ↑/↓ move · enter open · esc back.
        </Text>
      </Box>
    </Box>
  );
}
