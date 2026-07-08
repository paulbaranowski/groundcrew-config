import { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { valuesEqual } from "../domain/diff.ts";
import {
  isKindEnabled,
  readKindEnv,
  setKindEnabled,
  writeKindEnv,
  type CatalogSource,
} from "../domain/manifestSources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { binOnPath, secretFileExists } from "../io/prereqProbes.ts";
import { ShellEnvEditor } from "./ShellEnvEditor.tsx";

interface Props {
  /** The catalog entry (manifest included for discovered sources). */
  source: CatalogSource;
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
  /** Injected for testability; default to the real probes / process env. */
  probeBin?: (bin: string) => boolean;
  probeSecret?: (installDir: string, file: string) => boolean;
  env?: Record<string, string | undefined>;
}

/**
 * Generic editor for any discovered (manifest-backed) task source — jira is
 * just the first. Enabling writes a bare `{ kind: "<name>" }` entry; groundcrew
 * itself materializes the source's scripts on its next run, so there is no
 * install action here. Prerequisites and secrets are the user's job (groundcrew
 * never installs binaries or writes credentials): this screen probes their
 * state read-only and shows the manifest's own install/setup instructions for
 * whatever is missing. Follows the screen contract — see SectionForm.
 */
export function ManifestSourceForm({
  source,
  draft,
  baseline,
  onChange,
  onBack,
  probeBin = binOnPath,
  probeSecret = secretFileExists,
  env = process.env,
}: Props) {
  const kind = source.name;
  const manifest = source.manifest;
  const enabled = isKindEnabled(draft, kind);
  const [focus, setFocus] = useState(0);
  const [editingEnv, setEditingEnv] = useState(false);
  // Row 0 is the enable toggle; row 1 (when enabled) opens the env editor.
  const maxRow = enabled ? 1 : 0;
  const row = Math.min(focus, maxRow);
  // Mirror the row in a ref: a down+enter burst arriving in one input chunk
  // fires both handlers against the same stale closure, so reading `row` there
  // would drop the enter (same trick as TaskSourcesMenu's cursorRef — see the
  // testing notes in CLAUDE.md). Handlers MUST read `rowRef.current`.
  const rowRef = useRef(row);
  rowRef.current = row;

  // Probe once on mount, not per render: the probes hit the filesystem, and a
  // keystroke re-render must not re-scan PATH.
  const [prereqs] = useState(() =>
    (manifest?.prerequisites ?? []).map((p) => ({
      ...p,
      found: probeBin(p.bin),
    })),
  );
  const [secrets] = useState(() =>
    (manifest?.secrets ?? []).map((s) => {
      const envSet = (env[s.env] ?? "").length > 0;
      const fileSet =
        s.file !== undefined &&
        manifest?.installDir !== undefined &&
        probeSecret(manifest.installDir, s.file);
      return { ...s, found: envSet || fileSet };
    }),
  );

  useInput(
    (input, k) => {
      if (k.escape) {
        onBack();
        return;
      }
      if (k.downArrow) {
        rowRef.current = Math.min(maxRow, rowRef.current + 1);
        setFocus(rowRef.current);
      }
      if (k.upArrow) {
        rowRef.current = Math.max(0, rowRef.current - 1);
        setFocus(rowRef.current);
      }
      if (input === " " && rowRef.current === 0)
        onChange(setKindEnabled(draft, kind, !enabled));
      if (k.return && rowRef.current === 1) setEditingEnv(true);
    },
    { isActive: !editingEnv },
  );

  if (editingEnv) {
    return (
      <ShellEnvEditor
        env={readKindEnv(draft, kind)}
        baselineEnv={readKindEnv(baseline, kind)}
        onChange={(next) => onChange(writeKindEnv(draft, kind, next))}
        onBack={() => setEditingEnv(false)}
      />
    );
  }

  const enableModified = enabled !== isKindEnabled(baseline, kind);
  const envModified = !valuesEqual(
    readKindEnv(draft, kind),
    readKindEnv(baseline, kind),
  );
  const overrides = readKindEnv(draft, kind);
  const defaults = Object.entries(manifest?.env ?? {});

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>
        {kind} <Text dimColor>({source.origin} source)</Text>
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{source.description}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={row === 0 ? "cyan" : undefined}>
          {row === 0 ? "▸ " : "  "}Source:{" "}
          <Text color={enabled ? "green" : "yellow"}>
            {enabled ? "enabled" : "disabled"}
          </Text>
          {enableModified ? <Text color="yellow"> ●</Text> : null}
        </Text>
      </Box>
      {enabled ? (
        <Box>
          <Text color={row === 1 ? "cyan" : undefined}>
            {row === 1 ? "▸ " : "  "}env overrides:{" "}
            <Text dimColor>
              {overrides.length === 0
                ? "none (manifest defaults apply)"
                : overrides.map((e) => e.key).join(", ")}
            </Text>
            {envModified ? <Text color="yellow"> ●</Text> : null}
          </Text>
        </Box>
      ) : null}
      {defaults.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            defaults: {defaults.map(([k, v]) => `${k}=${v}`).join(" · ")}
          </Text>
        </Box>
      ) : null}
      {prereqs.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text>Prerequisites:</Text>
          {prereqs.map((p) => (
            <Box key={p.bin} flexDirection="column">
              {p.found ? (
                <Text>
                  {"  "}
                  <Text color="green">✓</Text> {p.bin}
                </Text>
              ) : (
                <Box flexDirection="column">
                  <Text>
                    {"  "}
                    <Text color="yellow">✗</Text> {p.bin}{" "}
                    <Text color="yellow">not found</Text>
                  </Text>
                  {p.install ? (
                    <Text dimColor>
                      {"    "}install: {p.install}
                    </Text>
                  ) : null}
                  {p.setup ? (
                    <Text dimColor>
                      {"    "}then: {p.setup}
                    </Text>
                  ) : null}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ) : null}
      {secrets.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text>Credentials:</Text>
          {secrets.map((s) => (
            <Box key={s.env} flexDirection="column">
              {s.found ? (
                <Text>
                  {"  "}
                  <Text color="green">✓</Text> {s.env}
                </Text>
              ) : (
                <Box flexDirection="column">
                  <Text>
                    {"  "}
                    <Text color="yellow">✗</Text> {s.env}{" "}
                    <Text color="yellow">not set</Text>
                  </Text>
                  {s.file !== undefined && manifest?.installDir !== undefined ? (
                    <Text dimColor>
                      {"    "}expected at {manifest.installDir}/{s.file}
                      {s.mode !== undefined ? ` (chmod ${s.mode})` : ""}
                    </Text>
                  ) : null}
                  {s.url ? (
                    <Text dimColor>
                      {"    "}create one: {s.url}
                    </Text>
                  ) : null}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          Space toggles the source (top row). Enabling is all groundcrew needs —
          it installs the source's scripts itself on the next crew run.
          Prerequisites and credentials above are set up outside this config.
          esc back.
        </Text>
      </Box>
    </Box>
  );
}
