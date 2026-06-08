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
});
