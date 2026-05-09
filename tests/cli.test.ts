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
      "Usage: tsx src/cli.ts [--html|--markdown|--roundtrip] <path/to/file.org>",
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
});
