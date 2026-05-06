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
        title: "Heading",
        tags: ["work", "urgent"],
        children: [],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe("* TODO Heading :work:urgent:");
  });

  it("round trips a mixed org document", () => {
    const input = [
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

    const ast = parse(input);
    const output = stringify(ast);

    expect(output).toBe(input);
    expect(parse(output)).toEqual(ast);
  });
});
