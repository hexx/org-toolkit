import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
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
      "Usage: tsx src/cli.ts [--markdown|--roundtrip] <path/to/file.org>",
    );
  });

  it("prints AST JSON for an org file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "org-toolkit-"));
    const filePath = join(directory, "sample.org");
    await writeFile(filePath, "* TODO Sample Heading :work:\n", "utf8");

    const exitCode = await main([filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.at(-1)?.[0];
    expect(typeof output).toBe("string");
    expect(JSON.parse(output as string)).toMatchObject({
      type: "root",
      children: [
        {
          type: "heading",
          todoKeyword: "TODO",
          title: "Sample Heading",
          tags: ["work"],
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
      "* TODO Project Plan :work:urgent:",
      "",
      "- [ ] Research",
      "- [X] Implement",
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
      "* TODO Project Plan",
      "",
      "- [ ] Research",
      "- [X] Implement",
    ].join("\n");
    await writeFile(filePath, source, "utf8");

    const exitCode = await main(["--markdown", filePath]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenLastCalledWith(
      [
        "# TODO Project Plan",
        "",
        "- [ ] Research",
        "- [x] Implement",
      ].join("\n"),
    );
  });
});
