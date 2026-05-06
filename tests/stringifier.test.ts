import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { stringify } from "../src/stringifier.js";

describe("stringify", () => {
  it("stringifies a heading with todo state and tags", () => {
    expect(
      stringify({
        type: "heading",
        level: 1,
        todoKeyword: "TODO",
        tags: ["work", "urgent"],
        properties: {},
        children: [
          { type: "text", value: "Heading", position: { start: { index: 0, line: 1, column: 1 }, end: { index: 7, line: 1, column: 8 } } },
        ],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe("* TODO Heading :work:urgent:");
  });

  it("stringifies inline markup nodes", () => {
    expect(
      stringify({
        type: "paragraph",
        children: [
          { type: "text", value: "A ", position: { start: { index: 0, line: 1, column: 1 }, end: { index: 2, line: 1, column: 3 } } },
          {
            type: "bold",
            children: [{ type: "text", value: "bold", position: { start: { index: 2, line: 1, column: 3 }, end: { index: 6, line: 1, column: 7 } } }],
            position: { start: { index: 2, line: 1, column: 3 }, end: { index: 8, line: 1, column: 9 } },
          },
          { type: "text", value: " text", position: { start: { index: 8, line: 1, column: 9 }, end: { index: 13, line: 1, column: 14 } } },
        ],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 13, line: 1, column: 14 },
        },
      }),
    ).toBe("A *bold* text");
  });

  it("stringifies link nodes", () => {
    expect(
      stringify({
        type: "link",
        url: "https://github.com",
        description: [
          {
            type: "bold",
            children: [{ type: "text", value: "GitHub", position: { start: { index: 0, line: 1, column: 1 }, end: { index: 6, line: 1, column: 7 } } }],
            position: { start: { index: 0, line: 1, column: 1 }, end: { index: 8, line: 1, column: 9 } },
          },
        ],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe("[[https://github.com][*GitHub*]]");
  });

  it("stringifies root metadata first", () => {
    expect(
      stringify({
        type: "root",
        metadata: {
          TITLE: "Org Mode Parsing",
          AUTHOR: "Alice",
        },
        children: [
          {
            type: "heading",
            level: 1,
            tags: [],
            properties: {},
            children: [{ type: "text", value: "Heading", position: { start: { index: 0, line: 1, column: 1 }, end: { index: 7, line: 1, column: 8 } } }],
            position: { start: { index: 0, line: 1, column: 1 }, end: { index: 0, line: 1, column: 1 } },
          },
        ],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe(["#+TITLE: Org Mode Parsing", "#+AUTHOR: Alice", "", "* Heading"].join("\n"));
  });

  it("stringifies heading property drawers", () => {
    expect(
      stringify({
        type: "heading",
        level: 1,
        todoKeyword: "TODO",
        tags: ["work", "urgent"],
        properties: {
          AUTHOR: "Alice",
          PRIORITY: "A",
        },
        children: [
          { type: "text", value: "Heading", position: { start: { index: 0, line: 1, column: 1 }, end: { index: 7, line: 1, column: 8 } } },
        ],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe(
      [
        "* TODO Heading :work:urgent:",
        ":PROPERTIES:",
        ":AUTHOR: Alice",
        ":PRIORITY: A",
        ":END:",
      ].join("\n"),
    );
  });

  it("stringifies planning lines and inline timestamps", () => {
    const input = [
      "* TODO Prepare presentation",
      "SCHEDULED: <2026-05-10 Sun> DEADLINE: <2026-05-12 Tue 10:00>",
      "Meeting is set for [2026-05-08 Fri 15:00].",
    ].join("\n");

    const ast = parse(input);

    expect(stringify(ast)).toBe(input);
    expect(parse(stringify(ast))).toEqual(ast);
  });

  it("stringifies comments and footnotes", () => {
    const input = [
      "# Comment about the doc",
      "",
      "See [fn:1] for details.",
      "",
      "[fn:1] Footnote *detail*.",
    ].join("\n");

    const ast = parse(input);

    expect(stringify(ast)).toBe(input);
    expect(parse(stringify(ast))).toEqual(ast);
  });

  it("stringifies block nodes", () => {
    expect(
      stringify({
        type: "block",
        blockName: "SRC",
        parameters: "typescript",
        content: "\nconsole.log('hi');\n",
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe(["#+BEGIN_SRC typescript", "console.log('hi');", "#+END_SRC"].join("\n"));
  });

  it("round trips a mixed org document", () => {
    const input = [
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

    const ast = parse(input);
    const output = stringify(ast);

    expect(output).toBe(input);
    expect(parse(output)).toEqual(ast);
  });
});
