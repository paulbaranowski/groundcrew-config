import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { SelectField } from "../components/SelectField.tsx";
import { TextField } from "../components/TextField.tsx";
import { BUILT_IN_MODELS, RUNNERS, type ConfigDraft } from "../domain/types.ts";
import type { Scope } from "../io/save.ts";

interface Props {
  onComplete: (scope: Scope, draft: ConfigDraft) => void;
  onCancel: () => void;
}

const PROJECT_DIR_PLACEHOLDER = "~/dev/groundcrew";

export function Wizard({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<Scope>("local");
  const [projectDir, setProjectDir] = useState("");
  const [repo, setRepo] = useState("");
  const [model, setModel] = useState<string>("claude");
  const [runner, setRunner] = useState<string>("auto");

  function finish(): void {
    // `runner` is a plain string here; groundcrew's loadConfig validates the
    // value at save time, so no enum cast is needed.
    const draft = {
      workspace: {
        projectDir: projectDir.length > 0 ? projectDir : PROJECT_DIR_PLACEHOLDER,
        knownRepositories: repo.length > 0 ? [repo] : [],
      },
      models: { default: model, definitions: { [model]: {} } },
      local: { runner },
    } as ConfigDraft;
    onComplete(scope, draft);
  }

  useInput((_input, key) => {
    if (key.escape) onCancel();
    if (key.return) {
      if (step < 4) setStep((s) => s + 1);
      else finish();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>crew-config · first-run setup</Text>
        <Text dimColor>step {step + 1}/5</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {step === 0 ? (
          <>
            <Text>Where should this config live?</Text>
            <SelectField
              label="scope"
              value={scope}
              options={["local", "global"]}
              isActive
              onChange={(v) => setScope(v as Scope)}
            />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Text>Project directory</Text>
            <Text dimColor>
              Where repos are cloned; worktrees too unless worktreeDir is set.
            </Text>
            <TextField
              label="projectDir"
              value={projectDir}
              placeholder={`${PROJECT_DIR_PLACEHOLDER}  (default)`}
              isActive
              onChange={setProjectDir}
            />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Text>
              Add a repository (owner/repo). Leave blank to add later.
            </Text>
            <TextField
              label="repository"
              value={repo}
              isActive
              onChange={setRepo}
            />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Text>Default agent model</Text>
            <SelectField
              label="model"
              value={model}
              options={BUILT_IN_MODELS}
              isActive
              onChange={setModel}
            />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Text>Sandbox runner</Text>
            <SelectField
              label="runner"
              value={runner}
              options={RUNNERS}
              isActive
              onChange={setRunner}
            />
          </>
        ) : null}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>enter next · esc cancel</Text>
      </Box>
    </Box>
  );
}
