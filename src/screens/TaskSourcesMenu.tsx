import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  shellSourceNames,
  taskSourceModified,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { LinearForm } from "./LinearForm.tsx";
import { PlanKeeperForm } from "./PlanKeeperForm.tsx";
import { ShellSourcesForm } from "./ShellSourcesForm.tsx";
import { TodoTxtForm } from "./TodoTxtForm.tsx";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
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
export function TaskSourcesMenu({ draft, baseline, onChange, onBack }: Props) {
  const [sub, setSub] = useState<Sub>("hub");
  const [cursor, setCursor] = useState(0);
  // Mirror the cursor in a ref so a down+enter burst in one render opens the
  // latest row. The useInput handler MUST read `cursorRef.current`, never the
  // render-time `cursor` state: every keystroke in one tick shares the same
  // stale closure, so reading `cursor` would open the pre-burst row. Do not
  // "simplify" the ref away.
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
    return (
      <LinearForm
        draft={draft}
        baseline={baseline}
        onChange={onChange}
        onBack={back}
      />
    );
  if (sub === "todoTxt")
    return (
      <TodoTxtForm
        draft={draft}
        baseline={baseline}
        onChange={onChange}
        onBack={back}
      />
    );
  if (sub === "planKeeper")
    return (
      <PlanKeeperForm
        draft={draft}
        baseline={baseline}
        onChange={onChange}
        onBack={back}
      />
    );
  if (sub === "shell")
    return (
      <ShellSourcesForm
        draft={draft}
        baseline={baseline}
        onChange={onChange}
        onBack={back}
      />
    );

  const modified = taskSourceModified(draft, baseline);
  const rows: Array<{
    id: Sub;
    label: string;
    status: string;
    modified: boolean;
  }> = [
    {
      id: "linear",
      label: "Linear",
      status: isLinearEnabled(draft) ? "enabled" : "disabled",
      modified: modified.linear,
    },
    {
      id: "todoTxt",
      label: "todo-txt",
      status: isTodoTxtEnabled(draft) ? "enabled" : "disabled",
      modified: modified.todoTxt,
    },
    {
      id: "planKeeper",
      label: "PlanKeeper",
      status: isPlanKeeperEnabled(draft) ? "enabled" : "disabled",
      modified: modified.planKeeper,
    },
    {
      id: "shell",
      label: "Shell sources",
      // Names (joined) instead of a bare count so the row can be scanned without
      // descending into the sub-form to see which sources are configured. Matches
      // the Home summary's shape (`sections.ts` → taskSources case).
      // `[].join(", ")` is "", so the `|| "none"` covers the empty case.
      status: shellSourceNames(draft).join(", ") || "none",
      modified: modified.shell,
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
            {row.modified ? <Text color="yellow"> ●</Text> : null}
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
