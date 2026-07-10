import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));

describe("main entry is browser/Worker-safe", () => {
  it("bundles for the browser without Node fs/path built-ins", async () => {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      platform: "browser",
      format: "esm",
      target: "es2022",
      write: false,
      logLevel: "silent",
    });

    const code = result.outputFiles.map((file) => file.text).join("\n");

    // Regression guard for https://github.com/hexx/org-toolkit/issues/78:
    // the public `.` entry must not statically depend on Node built-ins so
    // that `parse`, `format`, `stringify`, exporters, etc. bundle cleanly for
    // browsers and edge runnets (e.g. Cloudflare Workers without nodejs_compat).
    expect(code).not.toMatch(/node:fs\b/);
    expect(code).not.toMatch(/node:path\b/);
  });

  it("does not re-export Node-only file-system helpers from the main entry", async () => {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      platform: "browser",
      format: "esm",
      target: "es2022",
      write: false,
      logLevel: "silent",
    });

    const code = result.outputFiles.map((file) => file.text).join("\n");
    expect(code).not.toMatch(/\bformatFiles\b/);
    expect(code).not.toMatch(/\bresolveOrgFiles\b/);
  });
});
