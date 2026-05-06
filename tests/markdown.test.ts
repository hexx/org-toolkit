import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { toMarkdown } from "../src/exporters/markdown.js";

describe("toMarkdown", () => {
  it("stringifies a heading node", () => {
    expect(
      toMarkdown({
        type: "heading",
        level: 2,
        todoKeyword: "TODO",
        title: "Plan",
        tags: [],
        children: [],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe("## TODO Plan");
  });

  it("converts parsed org content to GFM", () => {
    const input = [
      "* TODO Project Plan",
      "",
      "- [ ] Research",
      "- [X] Implement",
      "",
      "| Name  | Age | Role     |",
      "|-----+---+--------|",
      "| Alice | 24  | Engineer |",
      "| Bob   | 30  | Designer |",
    ].join("\n");

    expect(toMarkdown(parse(input))).toBe(
      [
        "# TODO Project Plan",
        "",
        "- [ ] Research",
        "- [x] Implement",
        "",
        "| Name | Age | Role |",
        "|---|---|---|",
        "| Alice | 24 | Engineer |",
        "| Bob | 30 | Designer |",
      ].join("\n"),
    );
  });
});
