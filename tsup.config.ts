import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.tsx" },
  format: ["esm"],
  target: "node24",
  platform: "node",
  // groundcrew is resolved at runtime from the user's install, not bundled.
  external: ["@clipboard-health/groundcrew"],
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  // Packaged prompts ship as .md files alongside the bundled CLI; the loader
  // resolves them with `new URL('./prompts/', import.meta.url)`, which expects
  // `dist/prompts/` to exist next to `dist/cli.js`. Copy only the .md files —
  // the loader/install TS modules are already bundled into cli.js, and shipping
  // their .ts sources would just bloat the tarball.
  onSuccess: async () => {
    const src = "src/prompts";
    const dest = "dist/prompts";
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      if (!entry.endsWith(".md")) continue;
      copyFileSync(path.join(src, entry), path.join(dest, entry));
    }
  },
});
