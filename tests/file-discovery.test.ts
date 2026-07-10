import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOrgFiles } from "../src/file-discovery.js";

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "org-toolkit-discovery-"));
}

describe("resolveOrgFiles", () => {
  it("rejects non-.org files with a clear error", async () => {
    const directory = await tmp();
    const file = join(directory, "notes.md");
    await writeFile(file, "# not org", "utf8");

    await expect(resolveOrgFiles([file])).rejects.toThrow(/Org sources must be \.org files/);
  });

  it("throws when no org files match a directory or glob", async () => {
    const directory = await tmp();
    await writeFile(join(directory, "readme.md"), "nope", "utf8");

    await expect(resolveOrgFiles([directory])).rejects.toThrow(/No org files found/);
    await expect(resolveOrgFiles(["**/*.org"], directory)).rejects.toThrow(/No org files found/);
  });

  it("resolves a single .org file", async () => {
    const directory = await tmp();
    const file = join(directory, "a.org");
    await writeFile(file, "* TODO", "utf8");

    expect(await resolveOrgFiles([file])).toEqual([file]);
  });

  it("recurses into nested directories", async () => {
    const directory = await tmp();
    await mkdir(join(directory, "sub", "deep"), { recursive: true });

    const top = join(directory, "top.org");
    const mid = join(directory, "sub", "mid.org");
    const deep = join(directory, "sub", "deep", "deep.org");
    await writeFile(top, "* top", "utf8");
    await writeFile(mid, "* mid", "utf8");
    await writeFile(deep, "* deep", "utf8");

    const files = await resolveOrgFiles([directory]);
    expect([...files].sort()).toEqual([top, mid, deep].sort());
  });

  it("expands glob patterns and dedupes overlapping matches", async () => {
    const directory = await tmp();
    const a = join(directory, "a.org");
    const b = join(directory, "b.org");
    await writeFile(a, "* a", "utf8");
    await writeFile(b, "* b", "utf8");

    const files = await resolveOrgFiles(["*.org", "a.org"], directory);
    expect([...files].sort()).toEqual([a, b].sort());
    expect(files).toHaveLength(2);
  });
});
