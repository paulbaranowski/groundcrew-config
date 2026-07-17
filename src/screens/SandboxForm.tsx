import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListField, type ListItem } from "../components/ListField.tsx";
import { SelectField } from "../components/SelectField.tsx";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { setByPath } from "../domain/draftPath.ts";
import { modifiedByKey } from "../domain/modified.ts";
import {
  NETWORK_EGRESS,
  RUNNERS,
  type ConfigDraft,
} from "../domain/types.ts";
import { useEditGuard } from "../hooks/useEditGuard.ts";
import { SaveGuard } from "./SaveGuard.tsx";

interface Props {
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

// The four navigable rows on the "fields" mode, in top-to-bottom order.
// Enter on RUNNER/EGRESS is a no-op (SelectField takes ←/→); enter on either
// list row switches to that list's sub-mode.
const ROW_RUNNER = 0;
const ROW_EGRESS = 1;
const ROW_READONLY = 2;
const ROW_SAFEHOUSE = 3;
const LAST_ROW = ROW_SAFEHOUSE;

type Mode = "fields" | "readOnlyDirs" | "safehouseEnable";

/**
 * Section editor for the `local.*` sandbox block: the two scalar knobs
 * (`runner`, `networkEgress`) plus the two string-list knobs (`readOnlyDirs`,
 * `safehouse.enable`). Bespoke because SectionForm handles only text/number/
 * select scalars. Follows the screen contract — see SectionForm — writing back
 * through `onChange` on every edit; the two list sub-modes commit incrementally
 * too, so no top-level edit guard is needed here.
 */
export function SandboxForm({ draft, baseline, onChange, onBack }: Props) {
  const [mode, setMode] = useState<Mode>("fields");
  const [active, setActive] = useState(ROW_RUNNER);
  // Mirror `active` in a ref for the same burst reason ShellSourceSubForm /
  // ListField do: a fast ↑/↓-then-enter in one tick shares a stale closure and
  // would branch on the pre-burst row otherwise.
  const activeRef = useRef(ROW_RUNNER);
  function moveActive(next: number): void {
    activeRef.current = next;
    setActive(next);
  }

  const runner = draft.local?.runner ?? "auto";
  const egress = draft.local?.networkEgress ?? "allowlisted";
  const readOnlyDirs = draft.local?.readOnlyDirs ?? [];
  const safehouseEnable = draft.local?.safehouse?.enable ?? [];
  const baselineReadOnlyDirs = baseline.local?.readOnlyDirs ?? [];
  const baselineSafehouseEnable = baseline.local?.safehouse?.enable ?? [];

  function writePath(path: string, value: unknown): void {
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        path,
        value,
      ) as unknown as ConfigDraft,
    );
  }

  useInput(
    (_input, key) => {
      if (key.escape) onBack();
      if (key.downArrow) moveActive(Math.min(LAST_ROW, activeRef.current + 1));
      if (key.upArrow) moveActive(Math.max(0, activeRef.current - 1));
      if (key.return) {
        if (activeRef.current === ROW_READONLY) setMode("readOnlyDirs");
        else if (activeRef.current === ROW_SAFEHOUSE) setMode("safehouseEnable");
      }
    },
    { isActive: mode === "fields" },
  );

  if (mode === "readOnlyDirs") {
    return (
      <StringListEditor
        title="Read-only sandbox dirs"
        summary={
          "Absolute host directories re-opened read-only inside the sandbox " +
          "(safehouse + srt) for toolchains the sandbox profile masks but does " +
          "not re-open. ~ is expanded by groundcrew. Defaults to tfenv's config " +
          "root; setting your own list replaces the default."
        }
        entryTitle="Read-only sandbox dir"
        entryLabel="path"
        entryPlaceholder="absolute or ~ path, e.g. ~/.rbenv"
        addLabel="+ add directory…"
        items={readOnlyDirs}
        baselineItems={baselineReadOnlyDirs}
        onChange={(next) => writePath("local.readOnlyDirs", next)}
        onBack={() => setMode("fields")}
      />
    );
  }

  if (mode === "safehouseEnable") {
    return (
      <StringListEditor
        title="Safehouse extra profiles (enable)"
        summary={
          "Optional safehouse feature slugs layered on top of the default " +
          "deny-by-default policy, forwarded to `safehouse --enable=<comma-list>` " +
          "on every agent launch. Examples: `agent-browser` (chrome-devtools MCP), " +
          "`browser-native-messaging` (`claude --chrome`). Consumed only by the " +
          "safehouse runner."
        }
        entryTitle="Safehouse profile"
        entryLabel="enable"
        entryPlaceholder="feature slug, e.g. agent-browser"
        addLabel="+ add profile…"
        items={safehouseEnable}
        baselineItems={baselineSafehouseEnable}
        onChange={(next) => writePath("local.safehouse.enable", next)}
        onBack={() => setMode("fields")}
      />
    );
  }

  const runnerModified = !valuesEqual(baseline.local?.runner, draft.local?.runner);
  const egressModified = !valuesEqual(
    baseline.local?.networkEgress,
    draft.local?.networkEgress,
  );
  const readOnlyModified = !valuesEqual(baselineReadOnlyDirs, readOnlyDirs);
  const safehouseModified = !valuesEqual(
    baselineSafehouseEnable,
    safehouseEnable,
  );

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Sandbox</Text>
      <Box flexDirection="column" marginTop={1}>
        <SelectField
          label="runner"
          options={RUNNERS}
          value={runner}
          isActive={active === ROW_RUNNER}
          modified={runnerModified}
          onChange={(v) => writePath("local.runner", v)}
        />
        <SelectField
          label="networkEgress"
          options={NETWORK_EGRESS}
          value={egress}
          isActive={active === ROW_EGRESS}
          modified={egressModified}
          onChange={(v) => writePath("local.networkEgress", v)}
        />
        <SummaryRow
          label="readOnlyDirs"
          count={readOnlyDirs.length}
          unit="dir"
          isActive={active === ROW_READONLY}
          modified={readOnlyModified}
        />
        <SummaryRow
          label="safehouse.enable"
          count={safehouseEnable.length}
          unit="profile"
          isActive={active === ROW_SAFEHOUSE}
          modified={safehouseModified}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Pick the sandbox that isolates each agent from the rest of your machine.
          networkEgress and safehouse.enable apply only to the safehouse runner;
          readOnlyDirs re-opens masked host dirs read-only under safehouse + srt.
        </Text>
        <Text dimColor>
          ↑/↓ move · ←/→ cycle selects · enter opens list · esc back.
        </Text>
      </Box>
    </Box>
  );
}

function SummaryRow({
  label,
  count,
  unit,
  isActive,
  modified,
}: {
  label: string;
  count: number;
  unit: string;
  isActive: boolean;
  modified: boolean;
}) {
  return (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
        {label}{" "}
      </Text>
      <Text dimColor>
        {count} {unit}
        {count === 1 ? "" : "s"} — enter to edit
      </Text>
      {modified ? <Text color="yellow"> ●</Text> : null}
    </Box>
  );
}

// --------------------------------------------------------------------------

interface StringListProps {
  title: string;
  summary: string;
  entryTitle: string;
  entryLabel: string;
  entryPlaceholder: string;
  addLabel: string;
  items: string[];
  baselineItems: string[];
  onChange: (next: string[]) => void;
  onBack: () => void;
}

type Editing = number | "new";

/**
 * A reusable single-string list editor — a slim generalization of the pattern
 * `ShellSandboxPathsEditor` uses (a ListField over `string[]`, with an inline
 * `StringEntryEditor` sub-editor for one value). Blank entries are refused
 * (Enter is gated on non-blank, and dirty-esc → Apply on a whitespace-only
 * buffer treats Apply as Discard) so no `(unnamed)` row ever reaches the list.
 * Kept local to SandboxForm — if a third consumer appears, hoist to
 * `src/components/`.
 */
function StringListEditor({
  title,
  summary,
  entryTitle,
  entryLabel,
  entryPlaceholder,
  addLabel,
  items,
  baselineItems,
  onChange,
  onBack,
}: StringListProps) {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  // Same key trick as ShellSandboxPathsEditor: blanks fall back to a positional
  // key so two blank rows aren't collapsed onto one baseline slot; named
  // entries key by value so a reorder still diffs as unchanged.
  const modified = modifiedByKey(
    items,
    baselineItems,
    (value, i) => value || `__blank__${i}`,
  );

  useInput(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: editing === undefined },
  );

  if (editing !== undefined) {
    const value = editing === "new" ? "" : (items[editing] ?? "");
    return (
      <StringEntryEditor
        key={String(editing)}
        title={entryTitle}
        label={entryLabel}
        placeholder={entryPlaceholder}
        value={value}
        onSave={(next) => {
          onChange(
            editing === "new"
              ? [...items, next]
              : items.map((v, i) => (i === editing ? next : v)),
          );
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  }

  const listItems: ListItem[] = items.map((value, index) => ({
    label: value || "(unnamed)",
    note: undefined,
    error: undefined,
    modified: modified[index],
  }));

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{title}</Text>
      <Box marginTop={1} flexDirection="column">
        <ListField
          items={listItems}
          isActive
          addLabel={addLabel}
          onActivate={(index) =>
            setEditing(index >= items.length ? "new" : index)
          }
          onDelete={(index) => onChange(items.filter((_, i) => i !== index))}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{summary}</Text>
        <Text dimColor>↑/↓ move · enter edit · d delete · esc back.</Text>
      </Box>
    </Box>
  );
}

function StringEntryEditor({
  title,
  label,
  placeholder,
  value,
  onSave,
  onCancel,
}: {
  title: string;
  label: string;
  placeholder: string;
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [buffer, setBuffer] = useState(value);
  const guard = useEditGuard();

  useInput(
    (_input, k) => {
      if (k.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (k.return && buffer.trim().length > 0) onSave(buffer);
    },
    { isActive: !guard.guarding },
  );

  if (guard.guarding) {
    // A whitespace-only buffer must never reach the parent list — mirror the
    // Enter gate: dirty-esc → Apply on a blank buffer is treated as Discard.
    const apply = buffer.trim().length === 0 ? onCancel : () => onSave(buffer);
    return (
      <SaveGuard
        onApply={apply}
        onDiscard={onCancel}
        onCancel={guard.keepEditing}
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{title}</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label={label}
          value={buffer}
          placeholder={placeholder}
          isActive
          onChange={guard.track(setBuffer)}
        />
      </Box>
      {buffer.trim().length === 0 ? (
        <Box marginTop={1}>
          <Text color="yellow">⚠ value is required (a blank row is refused).</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>type to edit · enter apply · esc cancel.</Text>
      </Box>
    </Box>
  );
}
