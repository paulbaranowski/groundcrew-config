import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Footer } from "./components/Footer.tsx";
import {
  SECTION_LABEL,
  simpleSectionSpec,
  type SectionId,
} from "./domain/sections.ts";
import type { ConfigDraft } from "./domain/types.ts";
import { enabledSourceCount } from "./domain/sources.ts";
import { saveDraft, type Target } from "./io/save.ts";
import { validateDraft } from "./io/validate.ts";
import { Home } from "./screens/Home.tsx";
import { ModelsForm } from "./screens/ModelsForm.tsx";
import { QuitGuard } from "./screens/QuitGuard.tsx";
import { RepositoriesForm } from "./screens/RepositoriesForm.tsx";
import { SectionForm } from "./screens/SectionForm.tsx";
import { TaskSourcesMenu } from "./screens/TaskSourcesMenu.tsx";
import { UsageForm } from "./screens/UsageForm.tsx";
import { WorkspaceForm } from "./screens/WorkspaceForm.tsx";

interface Props {
  initialDraft: ConfigDraft | undefined;
  target: Target;
}

type Route = { name: "home" } | { name: "section"; id: SectionId };

export function App({ initialDraft, target }: Props) {
  const { exit } = useApp();
  const [draft, setDraft] = useState<ConfigDraft>(
    initialDraft ??
      ({ workspace: { projectDir: "", knownRepositories: [] } } as ConfigDraft),
  );
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [dirty, setDirty] = useState(false);
  const [valid, setValid] = useState(true);
  const [checked, setChecked] = useState(false);
  const [issues, setIssues] = useState<Set<SectionId>>(new Set());
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [quitting, setQuitting] = useState(false);

  // Debounced round-trip validation whenever the draft changes.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void validateDraft(draft).then((result) => {
        if (cancelled) return;
        setChecked(true);
        setValid(result.ok);
        setIssues(
          result.ok || result.section === undefined
            ? new Set()
            : new Set([result.section]),
        );
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft]);

  function update(next: ConfigDraft): void {
    setDraft(next);
    setDirty(true);
  }

  async function save(): Promise<void> {
    const result = await saveDraft(target, draft);
    setDirty(false);
    setSavedAt(
      result.shadowed.length > 0
        ? `${result.path} (moved ${result.shadowed.join(", ")})`
        : result.path,
    );
  }

  // Global quit handling on Home.
  useInput(
    (input) => {
      if (route.name !== "home") return;
      if (input === "s") void save();
      if (input === "q") {
        if (dirty) setQuitting(true);
        else exit();
      }
    },
    { isActive: route.name === "home" && !quitting },
  );

  if (quitting) {
    return (
      <QuitGuard
        onSaveQuit={() => void save().then(() => exit())}
        onDiscard={() => exit()}
        onCancel={() => setQuitting(false)}
      />
    );
  }

  const noSources = enabledSourceCount(draft) === 0;
  // crew run refuses without a task source, but loadConfig accepts empty sources,
  // so badge it here (separate from loadConfig validity).
  const homeIssues = noSources
    ? new Set<SectionId>([...issues, "ticketSources"])
    : issues;

  if (route.name === "home") {
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold>crew-config</Text>
          <Text dimColor>{savedAt ?? target.scope}</Text>
        </Box>
        <Box marginTop={1}>
          <Home
            draft={draft}
            issues={homeIssues}
            onOpen={(id) => setRoute({ name: "section", id })}
          />
        </Box>
        <Footer
          dirty={dirty}
          issues={issues.size}
          valid={valid}
          checked={checked}
          noSources={noSources}
          hint="↑/↓ move · enter edit · s save · q quit"
        />
      </Box>
    );
  }

  const id = route.id;
  const back = () => setRoute({ name: "home" });

  if (id === "workspace")
    return <WorkspaceForm draft={draft} onChange={update} onBack={back} />;
  if (id === "repositories")
    return <RepositoriesForm draft={draft} onChange={update} onBack={back} />;
  if (id === "ticketSources")
    return <TaskSourcesMenu draft={draft} onChange={update} onBack={back} />;
  if (id === "usage")
    return <UsageForm draft={draft} onChange={update} onBack={back} />;
  if (id === "models")
    return <ModelsForm draft={draft} onChange={update} onBack={back} />;
  return (
    <SectionForm
      title={SECTION_LABEL[id]}
      spec={simpleSectionSpec(id)}
      draft={draft}
      onChange={update}
      onBack={back}
    />
  );
}
