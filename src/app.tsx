import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Footer } from "./components/Footer.tsx";
import {
  SECTION_LABEL,
  simpleSectionSpec,
  type SectionId,
} from "./domain/sections.ts";
import type { ConfigDraft } from "./domain/types.ts";
import { setByPath } from "./domain/draftPath.ts";
import { saveDraft, type Target } from "./io/save.ts";
import { validateDraft } from "./io/validate.ts";
import { EscapeHatch } from "./screens/EscapeHatch.tsx";
import { Home } from "./screens/Home.tsx";
import { LinearForm } from "./screens/LinearForm.tsx";
import { QuitGuard } from "./screens/QuitGuard.tsx";
import { SectionForm } from "./screens/SectionForm.tsx";
import { Wizard } from "./screens/Wizard.tsx";
import { WorkspaceForm } from "./screens/WorkspaceForm.tsx";

interface Props {
  initialDraft: ConfigDraft | undefined;
  target: Target;
}

type Route =
  | { name: "wizard" }
  | { name: "home" }
  | { name: "section"; id: SectionId };

// Sections edited as raw JSON in $EDITOR: ticket-source adapters and the model
// definitions (built-in toggles + custom defs). v1 ships no bespoke form for these.
const ESCAPE_HATCH: SectionId[] = ["ticketSources", "models"];

export function App({ initialDraft, target }: Props) {
  const { exit } = useApp();
  const [draft, setDraft] = useState<ConfigDraft>(
    initialDraft ??
      ({ workspace: { projectDir: "", knownRepositories: [] } } as ConfigDraft),
  );
  const [route, setRoute] = useState<Route>(
    initialDraft ? { name: "home" } : { name: "wizard" },
  );
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Set<SectionId>>(new Set());
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [quitting, setQuitting] = useState(false);

  // Debounced round-trip validation whenever the draft changes.
  useEffect(() => {
    if (route.name === "wizard") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void validateDraft(draft).then((result) => {
        if (cancelled) return;
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
  }, [draft, route.name]);

  function update(next: ConfigDraft): void {
    setDraft(next);
    setDirty(true);
  }

  async function save(): Promise<void> {
    const result = await saveDraft(target, draft);
    setDirty(false);
    setSavedAt(
      result.shadowed
        ? `${result.path} (moved ${result.shadowed})`
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

  if (route.name === "wizard") {
    return (
      <Wizard
        onComplete={(_scope, completed) => {
          setDraft(completed);
          setDirty(true);
          setRoute({ name: "home" });
        }}
        onCancel={() => exit()}
      />
    );
  }

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
            issues={issues}
            onOpen={(id) => setRoute({ name: "section", id })}
          />
        </Box>
        <Footer
          dirty={dirty}
          issues={issues.size}
          hint="↑/↓ move · enter edit · s save · q quit"
        />
      </Box>
    );
  }

  const id = route.id;
  const back = () => setRoute({ name: "home" });

  if (id === "workspace")
    return <WorkspaceForm draft={draft} onChange={update} onBack={back} />;
  if (id === "linear")
    return <LinearForm draft={draft} onChange={update} onBack={back} />;
  if (ESCAPE_HATCH.includes(id)) {
    const hatchPath = id === "models" ? "models" : "sources";
    const hatchValue =
      id === "models" ? (draft.models ?? {}) : (draft.sources ?? []);
    return (
      <EscapeHatch
        title={SECTION_LABEL[id]}
        value={hatchValue}
        onChange={(next) =>
          update(
            setByPath(
              draft as unknown as Record<string, unknown>,
              hatchPath,
              next,
            ) as unknown as ConfigDraft,
          )
        }
        onBack={back}
      />
    );
  }
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
