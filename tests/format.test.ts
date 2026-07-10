import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { format } from "../src/format.js";
import { formatFiles } from "../src/file-system.js";

const TAG_COLUMN = 77;

describe("format", () => {
  it("normalizes tables, tags, and blank lines", () => {
    const input = [
      "* TODO Write docs :work:urgent:",
      "",
      "",
      "|Name|Age|",
      "|---+---|",
      "|Alice|24|",
      "|Bob|30|",
    ].join("\n");

    const heading = formatHeading("* TODO Write docs", ":work:urgent:");
    expect(format(input)).toBe(
      [
        heading,
        "",
        "| Name  | Age |",
        "|-----+---|",
        "| Alice | 24  |",
        "| Bob   | 30  |",
      ].join("\n"),
    );
  });

  it("formats multiple files and writes them in place", async () => {
    const root = await mkdtemp(join(tmpdir(), "org-toolkit-format-"));
    const dirty = [
      "* TODO Write docs :work:urgent:",
      "",
      "|Name|Age|",
      "|---+---|",
      "|Alice|24|",
    ].join("\n");
    await writeFile(join(root, "one.org"), dirty, "utf8");
    await writeFile(join(root, "two.org"), dirty, "utf8");

    const output = await formatFiles(["**/*.org"], { cwd: root, write: true });
    expect(output).toBe("");
    expect(await readFile(join(root, "one.org"), "utf8")).toBe(
      [
        formatHeading("* TODO Write docs", ":work:urgent:"),
        "",
        "| Name  | Age |",
        "|-----+---|",
        "| Alice | 24  |",
      ].join("\n"),
    );
    expect(await readFile(join(root, "two.org"), "utf8")).toBe(
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
  const padding = Math.max(1, TAG_COLUMN - body.length);
  return `${body}${" ".repeat(padding)}${tags}`;
}
