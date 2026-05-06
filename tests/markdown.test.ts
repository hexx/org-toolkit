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
        properties: {},
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

  it("renders planning lines and inline timestamps", () => {
    const input = [
      "* TODO Prepare presentation",
      "SCHEDULED: <2026-05-10 Sun> DEADLINE: <2026-05-12 Tue 10:00>",
      "Meeting is set for [2026-05-08 Fri 15:00].",
    ].join("\n");

    expect(toMarkdown(parse(input))).toBe(
      [
        "# TODO Prepare presentation",
        "**SCHEDULED:** 2026-05-10",
        "**DEADLINE:** 2026-05-12 10:00",
        "Meeting is set for 2026-05-08 15:00.",
      ].join("\n"),
    );
  });

  it("renders footnotes and ignores comments", () => {
    const input = [
      "# Comment about the doc",
      "",
      "See [fn:1] for details.",
      "",
      "[fn:1] Footnote *detail*.",
    ].join("\n");

    expect(toMarkdown(parse(input))).toBe(
      [
        "See [^1] for details.",
        "",
        "[^1]: Footnote **detail**.",
      ].join("\n"),
    );
  });
});
