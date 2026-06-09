import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import {
  getTodoTxtField,
  isTodoTxtEnabled,
  setTodoTxtEnabled,
  setTodoTxtField,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

type Focus = "todoPath" | "tasksDir";
const FOCI: Focus[] = ["todoPath", "tasksDir"];

export function TodoTxtForm({ draft, onChange, onBack }: Props) {
  const enabled = isTodoTxtEnabled(draft);
  const [focusIndex, setFocusIndex] = useState(0);
  const focus = FOCI[focusIndex] ?? "todoPath";

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === " ") onChange(setTodoTxtEnabled(draft, !enabled));
    if (!enabled) return;
    if (key.downArrow) setFocusIndex((f) => Math.min(FOCI.length - 1, f + 1));
    if (key.upArrow) setFocusIndex((f) => Math.max(0, f - 1));
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>todo-txt</Text>
      <Box marginTop={1}>
        <Text>
          todo-txt source:{" "}
          <Text color={enabled ? "green" : "yellow"}>
            {enabled ? "enabled" : "disabled"}
          </Text>
        </Text>
      </Box>
      {enabled ? (
        <Box flexDirection="column" marginTop={1}>
          <TextField
            label="todoPath"
            value={getTodoTxtField(draft, "todoPath") ?? ""}
            placeholder="~/todo.txt  (default)"
            isActive={focus === "todoPath"}
            onChange={(v) => onChange(setTodoTxtField(draft, "todoPath", v))}
          />
          <TextField
            label="tasksDir"
            value={getTodoTxtField(draft, "tasksDir") ?? ""}
            placeholder="~/tasks  (default)"
            isActive={focus === "tasksDir"}
            onChange={(v) => onChange(setTodoTxtField(draft, "tasksDir", v))}
          />
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Zero-credentials local-file task source. Space toggles. Other fields
          (defaultRepository, idPrefix, timezone) live in Custom JSON.
        </Text>
      </Box>
    </Box>
  );
}
