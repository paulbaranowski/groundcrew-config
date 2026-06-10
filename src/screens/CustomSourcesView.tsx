import { Box, Text, useInput } from "ink";

interface Props {
  title: string;
  value: unknown;
  onBack: () => void;
}

/**
 * Read-only view of the custom (unmanaged) shell task sources. The TUI has no
 * structured form for arbitrary shell adapters, and editing multi-line command
 * templates is better done in the file itself — so we show them, but leave
 * authoring to `crew.config.json`. The draft round-trips them untouched on save.
 */
export function CustomSourcesView({ title, value, onBack }: Props) {
  useInput((_input, key) => {
    if (key.escape) onBack();
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{title}</Text>
      <Box marginTop={1}>
        <Text dimColor>
          Read-only. Custom shell task sources are authored by hand in
          crew.config.json; the TUI preserves them on save but doesn't edit them.
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {JSON.stringify(value, undefined, 2)
          .split("\n")
          .map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>read-only · esc back</Text>
      </Box>
    </Box>
  );
}
