import { useEffect, useRef, useState } from "react";
import { homedir } from "node:os";
import { Box, Text, useInput } from "ink";
import { RC_SNIPPET } from "../domain/setup/clearance.ts";
import { FN_SAFE, FN_SAFE_CLAUDE } from "../domain/setup/safehouse.ts";
import type { RcMatch } from "../domain/setup/rcScan.ts";
import { runCrewDoctor, type CrewDoctorResult } from "../io/setup/crewDoctor.ts";
import {
  defaultInstallDeps,
  installGroundcrew,
  installSafehouse,
  probeGroundcrew,
  probeSafehouseFormula,
  type InstallReport,
} from "../io/setup/installs.ts";
import {
  probeClearance,
  probeSafehouse,
  type ClearanceStatus,
  type SafehouseStatus,
} from "../io/setup/probes.ts";
import {
  writeClearanceHosts,
  writeClearanceSidecar,
  writeSafehouseSidecar,
  type HostsWriteResult,
  type SidecarWriteResult,
} from "../io/setup/sidecars.ts";
import { CrewDoctorView } from "./CrewDoctorView.tsx";

// Every effect is injected so tests drive the screen with stubs and no real
// npm/brew/filesystem, mirroring how App takes initialDraft/target.
export interface SetupScreenDeps {
  platform: string;
  probeGroundcrew: () => Promise<InstallReport>;
  installGroundcrew: () => Promise<InstallReport>;
  probeSafehouse: () => Promise<InstallReport>;
  installSafehouse: () => Promise<InstallReport>;
  probeClearance: () => Promise<ClearanceStatus>;
  probeSafehouseSetup: () => Promise<SafehouseStatus>;
  writeHosts: () => HostsWriteResult;
  writeClearance: () => SidecarWriteResult;
  writeSafehouse: () => SidecarWriteResult;
  runCrewDoctor: () => Promise<CrewDoctorResult>;
}

export function defaultSetupScreenDeps(): SetupScreenDeps {
  const installDeps = defaultInstallDeps();
  return {
    platform: process.platform,
    probeGroundcrew: () => probeGroundcrew(installDeps),
    installGroundcrew: () => installGroundcrew(installDeps),
    probeSafehouse: () => probeSafehouseFormula(installDeps),
    installSafehouse: () => installSafehouse(installDeps),
    probeClearance: () => Promise.resolve(probeClearance(homedir())),
    probeSafehouseSetup: () => probeSafehouse(homedir()),
    writeHosts: () => writeClearanceHosts(homedir(), "append"),
    writeClearance: () => writeClearanceSidecar(homedir()),
    writeSafehouse: () => writeSafehouseSidecar(homedir()),
    runCrewDoctor: () => runCrewDoctor(),
  };
}

type RowPhase =
  | { phase: "checking" }
  | { phase: "acting" }
  | { phase: "ready"; report: InstallReport }
  | { phase: "not-applicable" };

type InstallRowId = "groundcrew" | "safehouse";
type SidecarRowId =
  | "clearanceHosts"
  | "clearanceSidecar"
  | "safehouseSidecar"
  | "crewDoctor";
type RowId = InstallRowId | SidecarRowId;

interface Row {
  id: RowId;
  label: string;
  detail: string;
}

const ROWS: Row[] = [
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
  {
    id: "clearanceHosts",
    label: "clearance hosts",
    detail: "~/.config/clearance/personal-allow-hosts (personal egress allowlist)",
  },
  {
    id: "clearanceSidecar",
    label: "clearance env.sh",
    detail: "~/.config/clearance/env.sh (env sidecar; sourced from your rc)",
  },
  {
    id: "safehouseSidecar",
    label: "safehouse env.sh",
    detail: "~/.config/agent-safehouse/env.sh (safe/safe-claude wrappers)",
  },
  {
    id: "crewDoctor",
    label: "run crew doctor",
    detail: "groundcrew's own health check (read-only)",
  },
];

const isInstallRow = (id: RowId): id is InstallRowId =>
  id === "groundcrew" || id === "safehouse";

function installRowText(state: RowPhase): string {
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
      return `failed: ${r.details} - enter to retry`;
    }
  }
}

interface Props {
  onBack: () => void;
  deps?: SetupScreenDeps;
}

// Doctor-style screen: probe everything up front, show per-row state, and let
// the user fix only what is broken. Mutations happen only on enter;
// re-running any fix is a reported no-op (I2), and rc files are only ever
// read (I3) - the sourcing snippet below the rows is a user instruction (N3).
export function SetupScreen({ onBack, deps }: Props) {
  const d = useRef(deps ?? defaultSetupScreenDeps()).current;
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [states, setStates] = useState<Record<InstallRowId, RowPhase>>({
    groundcrew: { phase: "checking" },
    safehouse:
      d.platform === "darwin"
        ? { phase: "checking" }
        : { phase: "not-applicable" },
  });
  // Mirror the row states in a ref for the same reason ListField mirrors its
  // cursor: a burst of keypresses delivered in one tick all share the same
  // stale render closure, so a double-enter would read "ready" twice and
  // start two parallel installs. activate() MUST read statesRef.current.
  const statesRef = useRef(states);

  const [clearance, setClearance] = useState<ClearanceStatus | null>(null);
  const [safehouseSetup, setSafehouseSetup] = useState<SafehouseStatus | null>(
    null,
  );
  // Same burst rule for the sidecar rows: busyRef guards double-enter.
  const [busy, setBusy] = useState<Record<SidecarRowId, boolean>>({
    clearanceHosts: false,
    clearanceSidecar: false,
    safehouseSidecar: false,
    crewDoctor: false,
  });
  const busyRef = useRef(busy);
  const [conflicts, setConflicts] = useState<{
    clearanceSidecar: RcMatch[];
    safehouseSidecar: RcMatch[];
  }>({ clearanceSidecar: [], safehouseSidecar: [] });
  // The clearance sidecar has no file-presence probe field and envExported
  // only flips in a fresh shell, so without this the row text would never
  // acknowledge a successful write and users re-press enter suspecting
  // failure.
  const [wroteClearanceSidecar, setWroteClearanceSidecar] = useState(false);
  // A sidecar write can throw (EACCES, ENOSPC); uncaught it would escape the
  // useInput handler and take down the whole app. The install rows degrade
  // failures into report rows; these mirror that with a retryable message.
  const [writeErrors, setWriteErrors] = useState<
    Record<"clearanceHosts" | "clearanceSidecar" | "safehouseSidecar", string | null>
  >({ clearanceHosts: null, clearanceSidecar: null, safehouseSidecar: null });
  const [doctorResult, setDoctorResult] = useState<CrewDoctorResult | null>(
    null,
  );
  const doctorRef = useRef<CrewDoctorResult | null>(null);
  // Sync the gate from state post-commit; opening also sets it synchronously
  // (below) so keys arriving before the re-render are already blocked.
  useEffect(() => {
    doctorRef.current = doctorResult;
  }, [doctorResult]);

  function setRow(id: InstallRowId, state: RowPhase): void {
    statesRef.current = { ...statesRef.current, [id]: state };
    setStates(statesRef.current);
  }

  function setBusyRow(id: SidecarRowId, value: boolean): void {
    busyRef.current = { ...busyRef.current, [id]: value };
    setBusy(busyRef.current);
  }

  // One mounted flag covers both the mount-time probes and the long-running
  // actions (installs and crew doctor can take minutes): a resolution landing
  // after the user esc'd away must not call setState on the unmounted screen.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void d.probeGroundcrew().then((report) => {
      if (mountedRef.current) setRow("groundcrew", { phase: "ready", report });
    });
    if (d.platform === "darwin") {
      void d.probeSafehouse().then((report) => {
        if (mountedRef.current) setRow("safehouse", { phase: "ready", report });
      });
      void d.probeSafehouseSetup().then((status) => {
        if (mountedRef.current) setSafehouseSetup(status);
      });
    }
    void d.probeClearance().then((status) => {
      if (mountedRef.current) setClearance(status);
    });
  }, [d]);

  function moveCursor(next: number): void {
    cursorRef.current = next;
    setCursor(next);
  }

  function activateInstall(id: InstallRowId): void {
    const state = statesRef.current[id];
    // "acting"/"checking"/"not-applicable" rows have no action (a second
    // enter mid-install must not double-run).
    if (state.phase !== "ready") return;
    // A failed row (probe timeout, install failure) retries with a fresh
    // probe: read-only, so a retry can never mutate; the probe's result
    // decides whether an install is offered next.
    if (state.report.action === "failed") {
      const probe = id === "groundcrew" ? d.probeGroundcrew : d.probeSafehouse;
      setRow(id, { phase: "checking" });
      void probe().then((report) => {
        if (mountedRef.current) setRow(id, { phase: "ready", report });
      });
      return;
    }
    if (state.report.action !== "missing") return;
    const install =
      id === "groundcrew" ? d.installGroundcrew : d.installSafehouse;
    setRow(id, { phase: "acting" });
    void install().then((report) => {
      if (mountedRef.current) setRow(id, { phase: "ready", report });
    });
  }

  function activateSidecar(id: SidecarRowId): void {
    if (busyRef.current[id]) return;
    if (
      id === "safehouseSidecar" &&
      d.platform !== "darwin" // N4: no action off macOS
    ) {
      return;
    }
    setBusyRow(id, true);
    if (id === "crewDoctor") {
      void d.runCrewDoctor().then((result) => {
        if (!mountedRef.current) return;
        doctorRef.current = result;
        setDoctorResult(result);
        setBusyRow(id, false);
      });
      return;
    }
    // The writes are synchronous and idempotent (I2); the re-probe that
    // follows refreshes the affected row so the state text reflects disk.
    try {
      if (id === "clearanceHosts") {
        d.writeHosts();
      } else if (id === "clearanceSidecar") {
        const result = d.writeClearance();
        setWroteClearanceSidecar(true);
        setConflicts((prev) => ({
          ...prev,
          clearanceSidecar: result.rcConflicts,
        }));
      } else {
        const result = d.writeSafehouse();
        setConflicts((prev) => ({
          ...prev,
          safehouseSidecar: result.rcConflicts,
        }));
      }
      setWriteErrors((prev) => ({ ...prev, [id]: null }));
    } catch (error) {
      setWriteErrors((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : String(error),
      }));
      setBusyRow(id, false);
      return;
    }
    const reprobe =
      id === "safehouseSidecar"
        ? d.probeSafehouseSetup().then((status) => {
            if (mountedRef.current) setSafehouseSetup(status);
          })
        : d.probeClearance().then((status) => {
            if (mountedRef.current) setClearance(status);
          });
    void reprobe.then(() => {
      if (mountedRef.current) setBusyRow(id, false);
    });
  }

  useInput((_input, key) => {
    // While the doctor view is open its own useInput owns the keyboard; this
    // handler stays registered (hooks run before the early return below), so
    // it must ignore everything or esc would also pop the whole screen.
    if (doctorRef.current !== null) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.downArrow)
      moveCursor(Math.min(ROWS.length - 1, cursorRef.current + 1));
    if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
    if (key.return) {
      const row = ROWS[cursorRef.current];
      if (!row) return;
      if (isInstallRow(row.id)) activateInstall(row.id);
      else activateSidecar(row.id);
    }
  });

  if (doctorResult !== null) {
    return (
      <CrewDoctorView
        result={doctorResult}
        // The ref is synced from state by the effect above rather than reset
        // here: a same-tick esc·esc burst would otherwise close the view AND
        // pop the whole Setup screen (the second esc passing a cleared gate).
        onClose={() => setDoctorResult(null)}
      />
    );
  }

  function sidecarRowText(id: SidecarRowId): string {
    if (busy[id]) return id === "crewDoctor" ? "running…" : "writing…";
    if (id !== "crewDoctor" && writeErrors[id] !== null) {
      return `failed: ${writeErrors[id]} - enter to retry`;
    }
    switch (id) {
      case "clearanceHosts": {
        if (clearance === null) return "checking…";
        if (clearance.personalFileExists && clearance.personalFileHasClaudeHosts)
          return "present ✓";
        if (clearance.personalFileExists)
          return "missing claude hosts - enter to append";
        return "not written - enter to create";
      }
      case "clearanceSidecar": {
        if (clearance === null) return "checking…";
        if (clearance.envExported) return "exported ✓";
        return wroteClearanceSidecar
          ? "written ✓ - now add the rc line below"
          : "write sidecar + add rc line";
      }
      case "safehouseSidecar": {
        if (d.platform !== "darwin") return "not applicable on this platform";
        if (safehouseSetup === null) return "checking…";
        if (safehouseSetup.sidecarPresent && safehouseSetup.sidecarHasFunctions)
          return "present ✓";
        if (safehouseSetup.sidecarPresent) {
          // A wrapper the rc owns is commented out in the sidecar, so
          // "functions missing" can mean "rc-defined", not broken - the
          // probe field alone is not the whole story.
          return conflicts.safehouseSidecar.some(
            (m) => m.item === FN_SAFE || m.item === FN_SAFE_CLAUDE,
          )
            ? "sidecar present (wrappers defined in your rc)"
            : "wrappers not in sidecar - enter to regenerate";
        }
        return "not written - enter to write";
      }
      case "crewDoctor":
        return "enter to run";
    }
  }

  function conflictNote(id: RowId): RcMatch[] {
    if (id === "clearanceSidecar") return conflicts.clearanceSidecar;
    if (id === "safehouseSidecar") return conflicts.safehouseSidecar;
    return [];
  }

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
              <Text dimColor>
                {" "}
                {isInstallRow(row.id)
                  ? installRowText(states[row.id])
                  : sidecarRowText(row.id)}
              </Text>
            </Box>
            {conflictNote(row.id).length > 0 ? (
              <Text dimColor>
                {"    "}
                defined in your rc:{" "}
                {conflictNote(row.id)
                  .map((m) => `${m.file}:${m.line} (${m.item})`)
                  .join(", ")}
              </Text>
            ) : null}
            {cursor === index ? (
              <Text dimColor>
                {"    "}
                {row.detail}
              </Text>
            ) : null}
          </Box>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>
          Add this line to your shell rc (~/.zshrc) yourself - crew-config
          never edits rc files:
        </Text>
        <Text dimColor>{RC_SNIPPET}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Installs and checks the tools groundcrew needs on this machine (it
          does not edit crew.config.json). The Sandbox section's networkEgress
          setting controls whether crew uses this allowlist. ↑/↓ move · enter
          fix · esc back. Headless: crew-config doctor.
        </Text>
      </Box>
    </Box>
  );
}
