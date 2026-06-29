import { useEffect, useState, type ReactNode } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Footer } from "./components/Footer.tsx";
import { useFullscreen } from "./hooks/useFullscreen.ts";
import {
  SECTION_DESCRIPTION,
  SECTION_LABEL,
  simpleSectionSpec,
  type SectionId,
} from "./domain/sections.ts";
import type { ConfigDraft } from "./domain/types.ts";
import { enabledSourceCount } from "./domain/sources.ts";
import path from "node:path";
import { saveDraft, targetPath, type Target } from "./io/save.ts";
import { validateDraft } from "./io/validate.ts";
import { Home } from "./screens/Home.tsx";
import { AgentsForm } from "./screens/AgentsForm.tsx";
import { PromptsScreen } from "./screens/PromptsScreen.tsx";
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

/**
 * Full-screen shell: sizes to the terminal so every screen occupies the same
 * box, with the body flex-growing and an optional footer pinned to the bottom
 * row regardless of how tall the content is. Hoisted to module scope so its
 * identity is stable — defining it inside App would remount the route subtree
 * (and drop input focus) on every render.
 */
function Screen({
  rows,
  columns,
  footer,
  children,
}: {
  rows: number;
  columns: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box width={columns} height={rows} flexDirection="column">
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>
      {footer}
    </Box>
  );
}

export function App({ initialDraft, target }: Props) {
  const { exit } = useApp();
  const { rows, columns } = useFullscreen();
  const [draft, setDraft] = useState<ConfigDraft>(
    initialDraft ??
      ({ workspace: { projectDir: "", knownRepositories: [] } } as ConfigDraft),
  );
  const [route, setRoute] = useState<Route>({ name: "home" });
  // Home's selected row lives here so it survives opening a section and
  // returning (Home unmounts while a section is on screen).
  const [homeCursor, setHomeCursor] = useState(0);
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
      void validateDraft(draft, path.dirname(targetPath(target))).then((result) => {
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
      <Screen rows={rows} columns={columns}>
        <QuitGuard
          onSaveQuit={() => void save().then(() => exit())}
          onDiscard={() => exit()}
          onCancel={() => setQuitting(false)}
        />
      </Screen>
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
      <Screen
        rows={rows}
        columns={columns}
        footer={
          <Footer
            dirty={dirty}
            issues={issues.size}
            valid={valid}
            checked={checked}
            noSources={noSources}
            hint="↑/↓ move · enter edit · s save · q quit"
          />
        }
      >
        <Box justifyContent="space-between">
          <Text bold>crew-config</Text>
          <Text dimColor>{savedAt ?? target.scope}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            groundcrew picks up your tickets and runs AI coding agents on them
            automatically — each in its own isolated copy of your repo — then
            opens a PR. Set it up below.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Home
            draft={draft}
            issues={homeIssues}
            cursor={homeCursor}
            onCursorChange={setHomeCursor}
            onOpen={(id) => setRoute({ name: "section", id })}
          />
        </Box>
      </Screen>
    );
  }

  const id = route.id;
  const back = () => setRoute({ name: "home" });
  const configDir = path.dirname(targetPath(target));

  const form =
    id === "workspace" ? (
      <WorkspaceForm draft={draft} onChange={update} onBack={back} />
    ) : id === "repositories" ? (
      <RepositoriesForm draft={draft} onChange={update} onBack={back} />
    ) : id === "ticketSources" ? (
      <TaskSourcesMenu draft={draft} onChange={update} onBack={back} />
    ) : id === "usage" ? (
      <UsageForm draft={draft} onChange={update} onBack={back} />
    ) : id === "agents" ? (
      <AgentsForm draft={draft} onChange={update} onBack={back} />
    ) : id === "prompts" ? (
      <PromptsScreen
        draft={draft}
        onChange={update}
        onBack={back}
        configDir={configDir}
      />
    ) : (
      <SectionForm
        title={SECTION_LABEL[id]}
        description={SECTION_DESCRIPTION[id]}
        spec={simpleSectionSpec(id)}
        draft={draft}
        onChange={update}
        onBack={back}
      />
    );

  return (
    <Screen rows={rows} columns={columns}>
      {form}
    </Screen>
  );
}
