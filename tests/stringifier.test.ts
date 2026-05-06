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

  it("round trips a mixed org document", () => {
    const input = [
      "* TODO Project *Plan* :work:urgent:",
      "",
      "- [ ] Research /background/",
      "- [X] Implement =core=",
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
