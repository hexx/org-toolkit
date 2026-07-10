import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli.js";

const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

afterEach(() => {
  logSpy.mockClear();
  errorSpy.mockClear();
});

const TAG_COLUMN = 77;

function formatHeading(body: string, tags: string): string {
  const padding = Math.max(1, TAG_COLUMN - body.length);
  return `${body}${" ".repeat(padding)}${tags}`;
}

describe("main", () => {
  it("shows usage and exits 1 when no path is provided", async () => {
    const exitCode = await main([]);

    expect(exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Usage: tsx src/cli.ts [--agenda|--format|--html|--markdown|--roundtrip] <path|glob>",
    );
  });

  it("reports file read failures and exits 1", async () => {
    const exitCode = await main(["/definitely/not-found.org"]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("defaults to printing the parsed AST as JSON and exits 0", async () => {
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
        },
      ],
    });
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
