import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli.js";

const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

afterEach(() => {
  logSpy.mockClear();
  errorSpy.mockClear();
});

describe("main", () => {
  it("shows usage when no path is provided", async () => {
    const exitCode = await main([]);

    expect(exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Usage: tsx src/cli.ts [--agenda|--format|--html|--markdown|--roundtrip] <path|glob>",
    );
  });

  it("prints AST JSON for an org file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    await writeFile(
      filePath,
      [
        "#+TITLE: Sample Document",
        "* TODO Sample Heading :work:",
        ":PROPERTIES:",
        ":AUTHOR: Alice",
        ":END:",
      ].join("\n"),
      "utf8",
    );

    const exitCode = await main([filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.at(-1)?.[0];
    expect(typeof output).toBe("string");
    expect(JSON.parse(output as string)).toMatchObject({
      type: "root",
      metadata: {
        TITLE: "Sample Document",
      },
      children: [
        {
          type: "heading",
          todoKeyword: "TODO",
          tags: ["work"],
          properties: {
            AUTHOR: "Alice",
          },
          children: [{ type: "text", value: "Sample Heading" }],
        },
      ],
    });
  });

  it("reports file read failures", async () => {
    const exitCode = await main(["/definitely/not-found.org"]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("prints roundtrip text when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    const source = [
      "#+TITLE: Org Mode Parsing",
      "#+DATE: 2026-05-06",
      "",
      "* TODO Project *Plan* :work:urgent:",
      ":PROPERTIES:",
      ":AUTHOR: Alice",
      ":PRIORITY: A",
      ":END:",
      "",
      "- [ ] Research /background/",
      "- [X] Implement =core=",
      "",
      "See [[https://github.com][*GitHub*]] now",
      "",
      "#+BEGIN_SRC typescript",
      "console.log('hi');",
      "#+END_SRC",
      "",
      "| Name  | Age | Role     |",
      "|-----+---+--------|",
      "| Alice | 24  | Engineer |",
      "| Bob   | 30  | Designer |",
    ].join("\n");
    await writeFile(filePath, source, "utf8");

    const exitCode = await main(["--roundtrip", filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenLastCalledWith(source);
  });

  it("prints markdown when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    const source = [
      "#+TITLE: Org Mode Parsing",
      "#+DATE: 2026-05-06",
      "",
      "* TODO Project *Plan* :work:urgent:",
      ":PROPERTIES:",
      ":AUTHOR: Alice",
      ":PRIORITY: A",
      ":END:",
      "",
      "- [ ] Research /background/",
      "- [X] Implement =core=",
      "",
      "See [[https://github.com][*GitHub*]] now",
      "",
      "#+BEGIN_SRC typescript",
      "console.log('hi');",
      "#+END_SRC",
    ].join("\n");
    await writeFile(filePath, source, "utf8");

    const exitCode = await main(["--markdown", filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenLastCalledWith(
      [
        "---",
        "title: Org Mode Parsing",
        "date: 2026-05-06",
        "---",
        "",
        "# TODO Project **Plan** <!-- :work:urgent: -->",
        "<!--",
        ":PROPERTIES:",
        ":AUTHOR: Alice",
        ":PRIORITY: A",
        ":END:",
        "-->",
        "",
        "- [ ] Research *background*",
        "- [x] Implement `core`",
        "",
        "See [**GitHub**](https://github.com) now",
        "",
        "```typescript",
        "console.log('hi');",
        "```",
      ].join("\n"),
    );
  });

  it("prints html when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    const source = [
      "#+TITLE: Org Mode Parsing",
      "",
      "* TODO Project <Plan> :work:urgent:",
      "",
      "- [ ] Research /background/",
      "- [X] Implement =core=",
      "",
      "See [[https://github.com][*GitHub*]] now",
      "",
      "| Name  | Age | Role     |",
      "|-----+---+--------|",
      "| Alice | 24  | Engineer |",
      "| Bob   | 30  | Designer |",
    ].join("\n");
    await writeFile(filePath, source, "utf8");

    const exitCode = await main(["--html", filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenLastCalledWith(
      [
        '<meta name="title" content="Org Mode Parsing">',
        "",
        "<h1>TODO Project &lt;Plan&gt;</h1>",
        "",
        "<ul><li><input type=\"checkbox\" disabled> Research <em>background</em></li><li><input type=\"checkbox\" disabled checked> Implement <code>core</code></li></ul>",
        "",
        '<p>See <a href="https://github.com"><strong>GitHub</strong></a> now</p>',
        "",
        "<table><thead><tr><th scope=\"col\">Name</th><th scope=\"col\">Age</th><th scope=\"col\">Role</th></tr></thead><tbody><tr><td>Alice</td><td>24</td><td>Engineer</td></tr><tr><td>Bob</td><td>30</td><td>Designer</td></tr></tbody></table>",
      ].join("\n"),
    );
  });

  it("prints an agenda when requested", async () => {
    const fixedNow = new Date("2026-05-09T12:00:00Z");
    const RealDate = Date;
    try {
      const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
      await mkdir(join(directory, "docs"), { recursive: true });

      await writeFile(
        join(directory, "work.org"),
        ["* TODO Fix critical bug", "DEADLINE: <2026-05-01 Fri>"].join("\n"),
        "utf8",
      );
      await writeFile(
        join(directory, "project.org"),
        ["* TODO Review pull request", "SCHEDULED: <2026-05-09 Fri>"].join("\n"),
        "utf8",
      );
      await writeFile(
        join(directory, "docs", "guide.org"),
        ["* TODO Write documentation", "DEADLINE: <2026-05-12 Mon>"].join("\n"),
        "utf8",
      );

      class MockDate extends RealDate {
        constructor(...args: [] | [number | string | Date]) {
          if (args.length === 0) {
            super(fixedNow);
            return;
          }

          super(args[0]);
        }

        static override now(): number {
          return fixedNow.getTime();
        }

        static override parse = RealDate.parse;
        static override UTC = RealDate.UTC;
      }

      globalThis.Date = MockDate as unknown as DateConstructor;
      const exitCode = await main(["--agenda", directory]);

      expect(exitCode).toBe(0);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenLastCalledWith(
        [
          "[OVERDUE]  2026-05-01 | TODO Fix critical bug (work.org)",
          "[TODAY]    2026-05-09 | TODO Review pull request (project.org)",
          "[UPCOMING] 2026-05-12 | TODO Write documentation (docs/guide.org)",
        ].join("\n"),
      );
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it("prints formatted org text when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    const source = [
      "* TODO Write docs :work:urgent:",
      "",
      "|Name|Age|",
      "|---+---|",
      "|Alice|24|",
    ].join("\n");
    await writeFile(filePath, source, "utf8");

    const exitCode = await main(["--format", filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenLastCalledWith(
      [
        formatHeading("* TODO Write docs", ":work:urgent:"),
        "",
        "| Name  | Age |",
        "|-----+---|",
        "| Alice | 24  |",
      ].join("\n"),
    );
  });

  it("writes formatted org text in place when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    const source = [
      "* TODO Write docs :work:urgent:",
      "",
      "|Name|Age|",
      "|---+---|",
      "|Alice|24|",
    ].join("\n");
    await writeFile(filePath, source, "utf8");

    const exitCode = await main(["--format", "--write", filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(
      await readFile(filePath, "utf8"),
    ).toBe(
      [
        formatHeading("* TODO Write docs", ":work:urgent:"),
        "",
        "| Name  | Age |",
        "|-----+---|",
        "| Alice | 24  |",
      ].join("\n"),
    );
  });
});

function formatHeading(body: string, tags: string): string {
  const padding = Math.max(1, 77 - body.length);
  return `${body}${" ".repeat(padding)}${tags}`;
}
