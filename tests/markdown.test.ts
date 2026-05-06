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
        tags: [],
        children: [
          { type: "text", value: "Plan", position: { start: { index: 0, line: 1, column: 1 }, end: { index: 4, line: 1, column: 5 } } },
        ],
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 0, line: 1, column: 1 },
        },
      }),
    ).toBe("## TODO Plan");
  });

  it("converts parsed org content to GFM", () => {
    const input = [
      "* TODO Project *Plan*",
      "",
      "- [ ] Research /background/",
      "- [X] Implement =core=",
      "",
      "#+begin_src typescript",
      "console.log('hi');",
      "#+end_src",
      "",
      "#+BEGIN_QUOTE",
      "Quoted line",
      "#+END_QUOTE",
      "",
      "| Name  | Age | Role     |",
      "|-----+---+--------|",
      "| Alice | 24  | Engineer |",
      "| Bob   | 30  | Designer |",
    ].join("\n");

    expect(toMarkdown(parse(input))).toBe(
      [
        "# TODO Project **Plan**",
        "",
        "- [ ] Research *background*",
        "- [x] Implement `core`",
        "",
        "```typescript",
        "console.log('hi');",
        "```",
        "",
        "> Quoted line",
        "",
        "| Name | Age | Role |",
        "|---|---|---|",
        "| Alice | 24 | Engineer |",
        "| Bob | 30 | Designer |",
      ].join("\n"),
    );
  });
});
