import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useFullscreen } from "../hooks/useFullscreen.ts";
import type { CrewDoctorResult } from "../io/setup/crewDoctor.ts";

interface Props {
  result: CrewDoctorResult;
  onClose: () => void;
}

// Read-only output pane for a `crew doctor` run, shared by the Setup screen's
// doctor row and App's post-save offer. Arrows scroll when the output is
// taller than the terminal; any other key closes.
export function CrewDoctorView({ result, onClose }: Props) {
  const { rows } = useFullscreen();
  const lines = result.output.split("\n");
  // Header, spacing, and footer chrome eat ~7 rows of the alt screen.
  const windowSize = Math.max(4, rows - 7);
  const maxOffset = Math.max(0, lines.length - windowSize);
  const [offset, setOffset] = useState(0);
  // Clamp at render time: a terminal resize can shrink maxOffset below a
  // previously valid offset, which would strand the view on a tail slice.
  const shown = Math.min(offset, maxOffset);
  const scrollable = maxOffset > 0;

  useInput((_input, key) => {
    if (scrollable && key.downArrow) {
      setOffset((o) => Math.min(maxOffset, Math.min(o, maxOffset) + 1));
      return;
    }
    if (scrollable && key.upArrow) {
      setOffset((o) => Math.max(0, Math.min(o, maxOffset) - 1));
      return;
    }
    onClose();
  });

  const ok = result.available && result.code === 0;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>crew doctor</Text>
        <Text color={ok ? "green" : "yellow"}>
          {result.available ? `exit ${result.code}` : "not run"}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>{lines.slice(shown, shown + windowSize).join("\n")}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {scrollable
            ? `↑/↓ scroll (${shown + 1}-${Math.min(
                lines.length,
                shown + windowSize,
              )}/${lines.length}) · any other key closes`
            : "press any key to close"}
        </Text>
      </Box>
    </Box>
  );
}
