import { rmSync } from "node:fs";
import { build } from "esbuild";

const entryPoints = ["src/index.ts", "src/file-system.ts", "src/cli.ts"];

const common = {
  entryPoints,
  bundle: true,
  platform: "node",
  target: "es2022",
  sourcemap: true,
  packages: "external", // dependencies (e.g. fast-glob) are kept external, like tsup's default
  logLevel: "info",
};

rmSync("dist", { recursive: true, force: true });

// ESM output -> dist/*.js
await build({
  ...common,
  format: "esm",
  outdir: "dist",
});

// CJS output -> dist/*.cjs
await build({
  ...common,
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  outdir: "dist",
});
