import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAgenda } from "../src/agenda.js";

async function createAgendaFixture(): Promise<{ readonly root: string; readonly now: Date }> {
  const root = await mkdtemp(join(tmpdir(), "org-toolkit-agenda-"));
  await mkdir(join(root, "docs"), { recursive: true });

  await writeFile(
    join(root, "work.org"),
    ["* TODO Fix critical bug", "DEADLINE: <2026-05-01 Fri>"].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "project.org"),
    ["* TODO Review pull request", "SCHEDULED: <2026-05-09 Fri>"].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "docs", "guide.org"),
    ["* TODO Write documentation", "DEADLINE: <2026-05-12 Mon>"].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "beta.org"),
    [
      "* TODO Second no date",
      ":PROPERTIES:",
      ":PRIORITY: B",
      ":END:",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "alpha.org"),
    [
      "* TODO First no date",
      ":PROPERTIES:",
      ":PRIORITY: A",
      ":END:",
    ].join("\n"),
    "utf8",
  );
  await writeFile(join(root, "clean.org"), "* TODO Clean up desktop", "utf8");

  return {
    root,
    now: new Date("2026-05-09T02:22:24.000Z"),
  };
}

describe("agenda", () => {
  it("sorts agenda items and formats source paths", async () => {
    const { root, now } = await createAgendaFixture();

    expect(await runAgenda([root], { cwd: root, now })).toBe(
      [
        "[OVERDUE]  2026-05-01 | TODO Fix critical bug (work.org)",
        "[TODAY]    2026-05-09 | TODO Review pull request (project.org)",
        "[UPCOMING] 2026-05-12 | TODO Write documentation (docs/guide.org)",
        "[NO DATE]             | TODO First no date (alpha.org)",
        "[NO DATE]             | TODO Second no date (beta.org)",
        "[NO DATE]             | TODO Clean up desktop (clean.org)",
      ].join("\n"),
    );
  });

  it("expands glob patterns across nested folders", async () => {
    const { root, now } = await createAgendaFixture();
    const directoryOutput = await runAgenda([root], { cwd: root, now });
    const globOutput = await runAgenda(["**/*.org"], { cwd: root, now });

    expect(globOutput).toBe(directoryOutput);
  });
});
