import { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  customSourceCount,
  isLinearDisabled,
  isPlanKeeperEnabled,
} from "../domain/sources.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { EscapeHatch } from "./EscapeHatch.tsx";
import { LinearForm } from "./LinearForm.tsx";
import { PlanKeeperForm } from "./PlanKeeperForm.tsx";

interface Props {
  draft: ConfigDraft;
  onChange: (next: ConfigDraft) => void;
  onBack: () => void;
}

type Sub = "hub" | "linear" | "planKeeper" | "custom";
const ROWS: Array<Exclude<Sub, "hub">> = ["linear", "planKeeper", "custom"];

export function TicketSourcesMenu({ draft, onChange, onBack }: Props) {
  const [sub, setSub] = useState<Sub>("hub");
  const [cursor, setCursor] = useState(0);

  useInput(
    (_input, key) => {
      if (sub !== "hub") return;
      if (key.escape) onBack();
      if (key.downArrow) setCursor((c) => Math.min(ROWS.length - 1, c + 1));
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.return) {
        const next = ROWS[cursor];
        if (next) setSub(next);
      }
    },
    { isActive: sub === "hub" },
  );

  const back = () => setSub("hub");

  if (sub === "linear")
    return <LinearForm draft={draft} onChange={onChange} onBack={back} />;
  if (sub === "planKeeper")
    return <PlanKeeperForm draft={draft} onChange={onChange} onBack={back} />;
  if (sub === "custom")
    return (
      <EscapeHatch
        title="Custom ticket sources"
        value={draft.sources ?? []}
        onChange={(next) =>
          onChange({ ...draft, sources: next as ConfigDraft["sources"] })
        }
        onBack={back}
      />
    );

  const rows: Array<{ id: Sub; label: string; status: string }> = [
    {
      id: "linear",
      label: "Linear",
      status: isLinearDisabled(draft) ? "disabled" : "enabled",
    },
    {
      id: "planKeeper",
      label: "PlanKeeper",
      status: isPlanKeeperEnabled(draft) ? "enabled" : "disabled",
    },
    {
      id: "custom",
      label: "Custom (raw JSON)",
      status: `${customSourceCount(draft)} source(s)`,
    },
  ];

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Ticket Sources</Text>
      <Box marginTop={1} flexDirection="column">
        {rows.map((row, index) => (
          <Box key={row.id}>
            <Text color={cursor === index ? "cyan" : undefined}>
              {cursor === index ? "▸ " : "  "}
            </Text>
            <Box width={20}>
              <Text color={cursor === index ? "cyan" : undefined}>
                {row.label}
              </Text>
            </Box>
            <Text dimColor>{row.status}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑/↓ move · enter open · esc back</Text>
      </Box>
    </Box>
  );
}
