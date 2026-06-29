import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { SelectField } from "../components/SelectField.tsx";
import { TextField } from "../components/TextField.tsx";
import { valuesEqual } from "../domain/diff.ts";
import { getByPath, setByPath } from "../domain/draftPath.ts";
import type { FieldSpec } from "../domain/sections.ts";
import type { ConfigDraft } from "../domain/types.ts";

interface Props {
  title: string;
  /** Plain-English purpose line shown above the focused field's help. */
  description: string;
  spec: FieldSpec[];
  draft: ConfigDraft;
  /** Last-saved draft; the anchor against which the `modified` markers diff. */
  baseline: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

function asString(value: unknown): string {
  return value === undefined ? "" : String(value);
}

// Screen contract (shared by every section editor): a screen receives the whole
// `draft`, emits the next draft via `onChange(nextDraft)`, and never saves or
// validates — App owns that. `onBack` returns to Home.
//
// The generic section editor: renders one FieldSpec row per entry in `spec`
// (TextField or SelectField), writing each leaf back through draftPath.
export function SectionForm({
  title,
  description,
  spec,
  draft,
  baseline,
  onChange,
  onBack,
}: Props) {
  const [active, setActive] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onBack();
    if (key.downArrow) setActive((a) => Math.min(spec.length - 1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
  });

  function update(field: FieldSpec, raw: string): void {
    let value: string | number | undefined;
    if (raw.length === 0) {
      value = undefined;
    } else if (field.kind === "number") {
      const parsed = Number(raw);
      // Ignore non-numeric input rather than store NaN (which serializes to
      // null and produces an invalid config).
      if (!Number.isFinite(parsed)) return;
      value = parsed;
    } else {
      value = raw;
    }
    // draftPath is the typed boundary: the draft crosses into setByPath as an
    // untyped record and back to ConfigDraft. The FieldPath union on field.path
    // is what keeps these casts honest about which leaves get written.
    onChange(
      setByPath(
        draft as unknown as Record<string, unknown>,
        field.path,
        value,
      ) as unknown as ConfigDraft,
    );
  }

  const focused = spec[active];
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{title}</Text>
      <Box flexDirection="column" marginTop={1}>
        {spec.map((field, index) => {
          const modified = !valuesEqual(
            getByPath(baseline, field.path),
            getByPath(draft, field.path),
          );
          return field.kind === "select" ? (
            <SelectField
              key={field.path}
              label={field.label}
              options={field.options ?? []}
              value={asString(
                getByPath(draft, field.path) ?? field.options?.[0],
              )}
              isActive={index === active}
              modified={modified}
              onChange={(v) => update(field, v)}
            />
          ) : (
            <TextField
              key={field.path}
              label={field.label}
              value={asString(getByPath(draft, field.path))}
              placeholder={field.placeholder}
              isActive={index === active}
              modified={modified}
              onChange={(v) => update(field, v)}
            />
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{description}</Text>
        {focused ? <Text dimColor>{focused.help}</Text> : null}
      </Box>
    </Box>
  );
}
