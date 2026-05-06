import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";

describe("parse", () => {
  it("parses the issue #1 sample heading into a root AST", () => {
    const input = "* TODO My First Heading :work:urgent:";

    expect(parse(input)).toEqual({
      type: "root",
      metadata: [],
      children: [
        {
          type: "heading",
          level: 1,
          todoKeyword: "TODO",
          title: "My First Heading",
          tags: ["work", "urgent"],
          children: [],
          position: {
            start: { index: 0, line: 1, column: 1 },
            end: { index: input.length, line: 1, column: input.length + 1 },
          },
        },
      ],
      position: {
        start: { index: 0, line: 1, column: 1 },
        end: { index: input.length, line: 1, column: input.length + 1 },
      },
    });
  });
});
