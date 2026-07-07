import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  hubRows,
  type CatalogSource,
  type HubRoute,
} from "../domain/manifestSources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { loadSourceCatalog } from "../io/sourceCatalog.ts";
import { LinearForm } from "./LinearForm.tsx";
import { ManifestSourceForm } from "./ManifestSourceForm.tsx";
import { PlanKeeperForm } from "./PlanKeeperForm.tsx";
import { ShellSourcesForm } from "./ShellSourcesForm.tsx";
import { TodoTxtForm } from "./TodoTxtForm.tsx";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
  /** Injected for testability; defaults to the real groundcrew catalog. */
  loadCatalog?: () => Promise<CatalogSource[]>;
}

/**
 * Hub for the taskSources section. Its rows are catalog-driven: the builtins
 * (Linear, todo-txt) plus every source groundcrew's open registry discovers
 * (jira, anything under ~/.config/groundcrew/task-sources), plus the PlanKeeper
 * preset and the shell builder. Row derivation lives in `hubRows`
 * (domain/manifestSources.ts); the catalog loads asynchronously on mount and
 * until (or unless — old groundcrew) it resolves, the static builtin rows
 * render alone, which is exactly the pre-catalog hub. Bespoke screens keep
 * their sub-routes; discovered kinds all route to the generic
 * ManifestSourceForm.
 */
export function TaskSourcesMenu({
  draft,
  baseline,
  onChange,
  onBack,
  loadCatalog = loadSourceCatalog,
}: Props) {
  const [sub, setSub] = useState<HubRoute | "hub">("hub");
  const [catalog, setCatalog] = useState<CatalogSource[]>([]);
  const [cursor, setCursor] = useState(0);
  // Mirror the cursor in a ref so a down+enter burst in one render opens the
  // latest row. The useInput handler MUST read `cursorRef.current`, never the
  // render-time `cursor` state: every keystroke in one tick shares the same
  // stale closure, so reading `cursor` would open the pre-burst row. Do not
  // "simplify" the ref away.
  const cursorRef = useRef(0);

  useEffect(() => {
    let alive = true;
    void loadCatalog().then((entries) => {
      if (alive) setCatalog(entries);
    });
    return () => {
      alive = false;
    };
  }, [loadCatalog]);

  const rows = hubRows(catalog, draft, baseline);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  useInput(
    (_input, key) => {
      if (sub !== "hub") return;
      if (key.escape) onBack();
      if (key.downArrow)
        moveCursor(Math.min(rows.length - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) {
        const next = rows[cursorRef.current];
        if (next) setSub(next.route);
      }
    },
    { isActive: sub === "hub" },
  );

  const back = () => setSub("hub");

  if (sub !== "hub") {
    if (sub.screen === "linear")
      return (
        <LinearForm
          draft={draft}
          baseline={baseline}
          onChange={onChange}
          onBack={back}
        />
      );
    if (sub.screen === "todoTxt")
      return (
        <TodoTxtForm
          draft={draft}
          baseline={baseline}
          onChange={onChange}
          onBack={back}
        />
      );
    if (sub.screen === "planKeeper")
      return (
        <PlanKeeperForm
          draft={draft}
          baseline={baseline}
          onChange={onChange}
          onBack={back}
        />
      );
    if (sub.screen === "shell")
      return (
        <ShellSourcesForm
          draft={draft}
          baseline={baseline}
          onChange={onChange}
          onBack={back}
        />
      );
    return (
      <ManifestSourceForm
        source={sub.source}
        draft={draft}
        baseline={baseline}
        onChange={onChange}
        onBack={back}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Task Sources</Text>
      <Box marginTop={1} flexDirection="column">
        {rows.map((row, index) => (
          <Box key={row.label}>
            <Text color={cursor === index ? "cyan" : undefined}>
              {cursor === index ? "▸ " : "  "}
            </Text>
            <Box width={20}>
              <Text color={cursor === index ? "cyan" : undefined}>
                {row.label}
              </Text>
            </Box>
            <Text dimColor>{row.status}</Text>
            {row.modified ? <Text color="yellow"> ●</Text> : null}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Where groundcrew gets its to-do list. Turn on one or more sources of
          tasks for it to work through. ↑/↓ move · enter open · esc back.
        </Text>
      </Box>
    </Box>
  );
}
