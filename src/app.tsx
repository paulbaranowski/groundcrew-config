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
    () =>
      initialDraft ??
      // Degenerate empty seed used when no config exists on disk; distinct from
      // defaultDraft(), the richer opinionated seed.
      ({
        workspace: { projectDir: "", knownRepositories: [] },
      } satisfies ConfigDraft),
  );
  // The last-saved draft: the anchor for unsaved-edit markers. Seeded to the same
  // value as `draft` so a freshly loaded config reads as "no edits yet"; reset to
  // `draft` on successful save so every marker clears at once.
  const [baseline, setBaseline] = useState<ConfigDraft>(() => draft);
  const [route, setRoute] = useState<Route>({ name: "home" });
  // Home's selected row lives here so it survives opening a section and
  // returning (Home unmounts while a section is on screen).
  const [homeCursor, setHomeCursor] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [valid, setValid] = useState(true);
  const [checked, setChecked] = useState(false);
  const [issues, setIssues] = useState<Set<SectionId>>(new Set());
  const [saved, setSaved] = useState(false);
  const [shadowed, setShadowed] = useState<string[]>([]);
  const [quitting, setQuitting] = useState(false);

  // Absolute path of the file we read from / write to, shown on Home so the
  // user always knows which config they're editing (not just its scope).
  const configPath = targetPath(target);

  // Debounced round-trip validation whenever the draft changes. Each run spawns a
  // child Node process (see validateDraft), so it is debounced to one per 150ms of
  // quiet; do not casually widen the dependency array — extra deps mean extra child
  // processes per keystroke.
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

  // The single mutation path for the draft: besides swapping in `next`, it marks
  // the draft `dirty` (unsaved edits exist, gating the quit guard and footer) and
  // clears `saved` (the green "✓ saved" indicator). Every screen's draft write
  // must route through this — a bare `setDraft` would silently leave `dirty`/`saved`
  // stale and the UI would lie about whether edits are persisted.
  function update(next: ConfigDraft): void {
    setDraft(next);
    setDirty(true);
    setSaved(false);
  }

  // Persists the draft and reconciles all save-state flags: clears `dirty`
  // (no unsaved edits remain), sets `saved` (drives the "✓ saved" indicator),
  // and records `shadowed` — the list of higher-precedence config files (.ts/.js)
  // that saveDraft renamed aside so our .json is the one groundcrew loads.
  async function save(): Promise<void> {
    const result = await saveDraft(target, draft);
    setBaseline(draft);
    setDirty(false);
    setSaved(true);
    setShadowed(result.shadowed);
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
  // `issues` carries only sections loadConfig flagged. Here we inject a synthetic
  // `taskSources` badge that is NOT derived from loadConfig validity: loadConfig
  // accepts an empty `sources[]`, but `crew run` refuses to do any work without a
  // task source. The badge nudges the user even though the config is technically
  // valid. The footer still reports `issues` (the real validity count) unchanged;
  // only Home's per-section badges see this augmented set.
  const homeIssues = noSources
    ? new Set<SectionId>([...issues, "taskSources"])
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
          <Text dimColor>{target.scope}</Text>
        </Box>
        <Box>
          <Text dimColor>
            editing{" "}
            <Text color={saved ? "green" : undefined}>{configPath}</Text>
            {saved ? <Text color="green"> ✓ saved</Text> : null}
            {saved && shadowed.length > 0 ? (
              <Text dimColor> (moved {shadowed.join(", ")})</Text>
            ) : null}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            groundcrew picks up your tasks and runs AI coding agents on them
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

  // Route dispatch: five section ids get bespoke screens via the explicit
  // branches below; every other SectionId falls through to the generic
  // SectionForm driven by `simpleSectionSpec(id)`. Adding a simple section
  // means adding a simpleSectionSpec case plus its registry entries
  // (SECTION_LABEL/SECTION_DESCRIPTION); adding a complex one means adding a
  // branch here. Either way, a new SectionId also needs an entry in
  // validate.ts's SECTION_PREFIXES, or its error badge mis-routes.
  const form =
    id === "workspace" ? (
      <WorkspaceForm draft={draft} onChange={update} onBack={back} />
    ) : id === "repositories" ? (
      <RepositoriesForm draft={draft} onChange={update} onBack={back} />
    ) : id === "taskSources" ? (
      <TaskSourcesMenu draft={draft} onChange={update} onBack={back} />
    ) : id === "usage" ? (
      <UsageForm draft={draft} onChange={update} onBack={back} />
    ) : id === "agents" ? (
      <AgentsForm draft={draft} onChange={update} onBack={back} />
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
