import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextField } from "../components/TextField.tsx";
import {
  getTodoTxtField,
  isTodoTxtEnabled,
  setTodoTxtEnabled,
  setTodoTxtField,
  type TodoTxtField,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

const FIELDS: Array<{ field: TodoTxtField; placeholder: string }> = [
  { field: "todoPath", placeholder: "~/todo.txt  (default)" },
  { field: "tasksDir", placeholder: "~/tasks  (default)" },
  { field: "defaultRepository", placeholder: "owner/repo  (optional)" },
  { field: "idPrefix", placeholder: "GC  (default)" },
  { field: "timezone", placeholder: "UTC  (default)" },
];

// Section editor for the todo-txt task source: an enable toggle plus its local
// file/dir/prefix/timezone fields. Follows the screen contract — see SectionForm.
export function TodoTxtForm({ draft, onChange, onBack }: Props) {
  const enabled = isTodoTxtEnabled(draft);
  const [focusIndex, setFocusIndex] = useState(0);
  const focus = FIELDS[focusIndex]?.field ?? "todoPath";

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === " ") onChange(setTodoTxtEnabled(draft, !enabled));
    if (!enabled) return;
    if (key.downArrow) setFocusIndex((f) => Math.min(FIELDS.length - 1, f + 1));
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
          {FIELDS.map(({ field, placeholder }) => (
            <TextField
              key={field}
              label={field}
              value={getTodoTxtField(draft, field) ?? ""}
              placeholder={placeholder}
              isActive={focus === field}
              onChange={(v) => onChange(setTodoTxtField(draft, field, v))}
            />
          ))}
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Use a plain todo.txt file on your computer as the task list — no
          accounts or API keys needed. Space toggles. ↑/↓ moves between fields.
        </Text>
      </Box>
    </Box>
  );
}
