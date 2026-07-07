import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  defaultInstallDeps,
  installGroundcrew,
  installSafehouse,
  probeGroundcrew,
  probeSafehouseFormula,
  type InstallReport,
} from "../io/setup/installs.ts";

// Every effect is injected so tests drive the screen with stubs and no real
// npm/brew, mirroring how App takes initialDraft/target.
export interface SetupScreenDeps {
  platform: string;
  probeGroundcrew: () => Promise<InstallReport>;
  installGroundcrew: () => Promise<InstallReport>;
  probeSafehouse: () => Promise<InstallReport>;
  installSafehouse: () => Promise<InstallReport>;
}

export function defaultSetupScreenDeps(): SetupScreenDeps {
  const installDeps = defaultInstallDeps();
  return {
    platform: process.platform,
    probeGroundcrew: () => probeGroundcrew(installDeps),
    installGroundcrew: () => installGroundcrew(installDeps),
    probeSafehouse: () => probeSafehouseFormula(installDeps),
    installSafehouse: () => installSafehouse(installDeps),
  };
}

type RowPhase =
  | { phase: "checking" }
  | { phase: "acting" }
  | { phase: "ready"; report: InstallReport }
  | { phase: "not-applicable" };

interface InstallRow {
  id: "groundcrew" | "safehouse";
  label: string;
  detail: string;
}

const ROWS: InstallRow[] = [
  {
    id: "groundcrew",
    label: "groundcrew",
    detail: "npm global @clipboard-health/groundcrew",
  },
  {
    id: "safehouse",
    label: "safehouse",
    detail: "brew eugene1g/safehouse/agent-safehouse (macOS sandbox)",
  },
];

function rowText(state: RowPhase): string {
  switch (state.phase) {
    case "checking":
      return "checking…";
    case "acting":
      return "installing…";
    case "not-applicable":
      return "not applicable on this platform";
    case "ready": {
      const r = state.report;
      if (r.action === "already-installed" || r.action === "installed") {
        return `${r.version ?? "installed"} ✓`;
      }
      if (r.action === "missing") return "not installed - enter to install";
      return `failed: ${r.details}`;
    }
  }
}

interface Props {
  onBack: () => void;
  deps?: SetupScreenDeps;
}

// Doctor-style screen: probe everything up front, show per-row state, and let
// the user fix only what is broken. Mutations happen only on enter;
// re-running an install is a reported no-op.
export function SetupScreen({ onBack, deps }: Props) {
  const d = useRef(deps ?? defaultSetupScreenDeps()).current;
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [states, setStates] = useState<Record<InstallRow["id"], RowPhase>>({
    groundcrew: { phase: "checking" },
    safehouse:
      d.platform === "darwin"
        ? { phase: "checking" }
        : { phase: "not-applicable" },
  });

  function setRow(id: InstallRow["id"], state: RowPhase): void {
    setStates((prev) => ({ ...prev, [id]: state }));
  }

  useEffect(() => {
    let cancelled = false;
    void d.probeGroundcrew().then((report) => {
      if (!cancelled) setRow("groundcrew", { phase: "ready", report });
    });
    if (d.platform === "darwin") {
      void d.probeSafehouse().then((report) => {
        if (!cancelled) setRow("safehouse", { phase: "ready", report });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [d]);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  function activate(id: InstallRow["id"]): void {
    const state = states[id];
    // Only a probed-missing row has an action; everything else is a no-op.
    if (state.phase !== "ready" || state.report.action !== "missing") return;
    const install =
      id === "groundcrew" ? d.installGroundcrew : d.installSafehouse;
    setRow(id, { phase: "acting" });
    void install().then((report) => setRow(id, { phase: "ready", report }));
  }

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.downArrow)
      moveCursor(Math.min(ROWS.length - 1, cursorRef.current + 1));
    if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
    if (key.return) {
      const row = ROWS[cursorRef.current];
      if (row) activate(row.id);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Setup</Text>
      <Box marginTop={1} flexDirection="column">
        {ROWS.map((row, index) => (
          <Box key={row.id} flexDirection="column">
            <Box>
              <Text color={cursor === index ? "cyan" : undefined}>
                {cursor === index ? "▸ " : "  "}
                {row.label}
              </Text>
              <Text dimColor> {rowText(states[row.id])}</Text>
            </Box>
            {cursor === index ? (
              <Text dimColor>
                {"    "}
                {row.detail}
              </Text>
            ) : null}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Installs and checks the tools groundcrew needs on this machine (it
          does not edit crew.config.json; the Sandbox section holds the related
          networkEgress setting). ↑/↓ move · enter install · esc back. Headless:
          crew-config doctor.
        </Text>
      </Box>
    </Box>
  );
}
