import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { modifiedSections } from "./domain/modified.ts";
import {
  enabledSourceCount,
  migratePlanKeeperSandboxPaths,
} from "./domain/sources.ts";
import path from "node:path";
import { saveDraft, targetPath, type Target } from "./io/save.ts";
import {
  runCrewDoctor,
  type CrewDoctorResult,
} from "./io/setup/crewDoctor.ts";
import { validateDraft } from "./io/validate.ts";
import { CrewDoctorView } from "./screens/CrewDoctorView.tsx";
import { Home } from "./screens/Home.tsx";
import { AgentsForm } from "./screens/AgentsForm.tsx";
import { SetupScreen, type SetupScreenDeps } from "./screens/SetupScreen.tsx";
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
  /** Injectable for tests so opening Setup never probes the real npm/brew. */
  setupDeps?: SetupScreenDeps;
  /** Injectable for tests; defaults to the real crew-doctor runner. */
  crewDoctor?: () => Promise<CrewDoctorResult>;
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

export function App({ initialDraft, target, setupDeps, crewDoctor }: Props) {
  const { exit } = useApp();
  const { rows, columns } = useFullscreen();
  // Raw on-disk shape (degenerate empty seed if no config exists). Used as the
  // baseline anchor so any in-memory migrations applied to `draft` surface as
  // normal `●` unsaved-edit markers.
  const rawInitial =
    initialDraft ??
    // Degenerate empty seed used when no config exists on disk; distinct from
    // defaultDraft(), the richer opinionated seed.
    ({
      workspace: { projectDir: "", knownRepositories: [] },
    } satisfies ConfigDraft);
  const [draft, setDraft] = useState<ConfigDraft>(() =>
    migratePlanKeeperSandboxPaths(rawInitial),
  );
  // The last-saved draft: the anchor for unsaved-edit markers. Seeded from the
  // RAW load (not the migrated draft) so an automatic migration — e.g. backfilling
  // ~/plans into a pre-4.42 PlanKeeper entry — shows up as a normal `●` the user
  // can choose to save (or quit to leave the file as-is). Reset to `draft` on
  // successful save so every marker clears at once.
  const [baseline, setBaseline] = useState<ConfigDraft>(() => rawInitial);
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
  // Post-save crew-doctor offer (F7): appears once per successful save so a
  // fresh setup ends with a verified-working signal; any edit invalidates it.
  const [doctorOffer, setDoctorOffer] = useState<
    "hidden" | "offered" | "running"
  >("hidden");
  const [doctorResult, setDoctorResult] = useState<CrewDoctorResult | null>(
    null,
  );

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
    // An edit invalidates the just-saved state, so the stale offer goes away.
    setDoctorOffer("hidden");
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
    setDoctorOffer("offered");
  }

  // Global quit handling on Home, plus the post-save doctor offer's keys.
  useInput(
    (input, key) => {
      if (route.name !== "home") return;
      // While the doctor result view is open its own useInput owns the
      // keyboard; without this gate "s"/"q" would save or quit underneath it.
      if (doctorResult !== null) return;
      if (doctorOffer === "offered") {
        if (input === "y") {
          setDoctorOffer("running");
          void (crewDoctor ?? runCrewDoctor)().then((result) => {
            setDoctorResult(result);
            setDoctorOffer("hidden");
          });
          return;
        }
        if (key.escape) {
          setDoctorOffer("hidden");
          return;
        }
      }
      if (input === "s") void save();
      if (input === "q") {
        if (dirty) setQuitting(true);
        else exit();
      }
    },
    { isActive: route.name === "home" && !quitting },
  );

  // Computed BEFORE any conditional early return — Rules-of-Hooks requires
  // every render to call the same hooks in the same order, and the `quitting`
  // branch below would otherwise skip this one on first entry, then re-call it
  // after cancel, tripping React's "Rendered fewer hooks than expected" check.
  const modified = useMemo(
    () => modifiedSections(baseline, draft),
    [baseline, draft],
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

  if (doctorResult !== null) {
    return (
      <Screen rows={rows} columns={columns}>
        <CrewDoctorView
          result={doctorResult}
          onClose={() => setDoctorResult(null)}
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
        {doctorOffer !== "hidden" ? (
          <Box>
            <Text>
              Run crew doctor to verify?{" "}
              <Text dimColor>
                {doctorOffer === "running"
                  ? "running…"
                  : "[y] run · [esc] dismiss"}
              </Text>
            </Text>
          </Box>
        ) : null}
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
            modified={modified}
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

  // Route dispatch: the bespoke section ids get explicit branches below;
  // every other SectionId falls through to the generic SectionForm driven by
  // `simpleSectionSpec(id)`. Adding a simple section means adding a
  // simpleSectionSpec case plus its registry entries
  // (SECTION_LABEL/SECTION_DESCRIPTION); adding a complex one means adding a
  // branch here. A new config-backed SectionId also needs an entry in
  // sectionRouting.ts's SECTION_PREFIXES, or its error badge mis-routes.
  // ("setup" is machine state, not config-backed: no key path may route to
  // it, so it deliberately has no SECTION_PREFIXES entry and ignores the
  // draft entirely.)
  const form =
    id === "setup" ? (
      <SetupScreen onBack={back} deps={setupDeps} />
    ) : id === "workspace" ? (
      <WorkspaceForm
        draft={draft}
        baseline={baseline}
        onChange={update}
        onBack={back}
      />
    ) : id === "repositories" ? (
      <RepositoriesForm
        draft={draft}
        baseline={baseline}
        onChange={update}
        onBack={back}
      />
    ) : id === "taskSources" ? (
      <TaskSourcesMenu
        draft={draft}
        baseline={baseline}
        onChange={update}
        onBack={back}
      />
    ) : id === "usage" ? (
      <UsageForm
        draft={draft}
        baseline={baseline}
        onChange={update}
        onBack={back}
      />
    ) : id === "agents" ? (
      <AgentsForm
        draft={draft}
        baseline={baseline}
        onChange={update}
        onBack={back}
      />
    ) : id === "prompts" ? (
      <PromptsScreen
        draft={draft}
        baseline={baseline}
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
        baseline={baseline}
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
