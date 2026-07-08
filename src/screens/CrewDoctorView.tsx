import { Box, Text, useInput } from "ink";
import type { CrewDoctorResult } from "../io/setup/crewDoctor.ts";

interface Props {
  result: CrewDoctorResult;
  onClose: () => void;
}

// Read-only output pane for a `crew doctor` run, shared by the Setup screen's
// doctor row and App's post-save offer. Any key closes it.
export function CrewDoctorView({ result, onClose }: Props) {
  useInput(() => onClose());
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
        <Text>{result.output}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>press any key to close</Text>
      </Box>
    </Box>
  );
}
