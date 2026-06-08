import { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { editJson } from "../io/editJson.ts";

interface Props {
  title: string;
  value: unknown;
  onChange: (next: unknown) => void;
  onBack: () => void;
}

export function EscapeHatch({ title, value, onChange, onBack }: Props) {
  const { setRawMode } = useStdin();
  const [error, setError] = useState<string | undefined>(undefined);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === "e") {
      // Release Ink's hold on stdin so the editor owns the terminal.
      setRawMode(false);
      void editJson(value).then((result) => {
        setRawMode(true);
        if (result.ok) {
          setError(undefined);
          onChange(result.value);
        } else setError(result.error);
      });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{title}</Text>
      <Box marginTop={1}>
        <Text dimColor>Advanced section — edited as raw JSON in $EDITOR.</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {JSON.stringify(value, undefined, 2)
          .split("\n")
          .map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>e edit in $EDITOR · esc back</Text>
      </Box>
    </Box>
  );
}
