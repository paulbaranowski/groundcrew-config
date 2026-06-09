import { homedir } from "node:os";
import path from "node:path";

/** groundcrew's global config directory: `$XDG_CONFIG_HOME/groundcrew` or `~/.config/groundcrew`. */
export function xdgConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME;
  if (base !== undefined && base.length > 0) {
    return path.join(base, "groundcrew");
  }
  return path.join(homedir(), ".config", "groundcrew");
}
