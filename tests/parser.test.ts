import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";

describe("parse", () => {
  it("parses the issue #1 sample heading into a root AST", () => {
    const input = "* TODO My First Heading :work:urgent:";

    expect(parse(input)).toEqual({
      type: "root",
      metadata: {},
      children: [
        {
          type: "heading",
          level: 1,
          todoKeyword: "TODO",
          tags: ["work", "urgent"],
          properties: {},
          children: [
            {
              type: "text",
              value: "My First Heading",
              position: {
                start: { index: 7, line: 1, column: 8 },
                end: { index: 23, line: 1, column: 24 },
              },
            },
          ],
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

  it("parses heading property drawers into heading properties", () => {
    const input = [
      "* TODO My First Heading :work:urgent:",
      ":PROPERTIES:",
      ":AUTHOR: Alice",
      ":PRIORITY: A",
      ":END:",
      "",
      "This is the content.",
    ].join("\n");

    expect(parse(input)).toMatchObject({
      children: [
        {
          type: "heading",
          todoKeyword: "TODO",
          tags: ["work", "urgent"],
          properties: {
            AUTHOR: "Alice",
            PRIORITY: "A",
          },
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "This is the content." }],
        },
      ],
    });
  });

  it("parses planning lines and inline timestamps", () => {
    const input = [
      "* TODO Prepare presentation",
      "SCHEDULED: <2026-05-10 Sun> DEADLINE: <2026-05-12 Tue 10:00>",
      "Meeting is set for [2026-05-08 Fri 15:00].",
    ].join("\n");

    expect(parse(input)).toMatchObject({
      children: [
        {
          type: "heading",
          todoKeyword: "TODO",
          planning: {
            scheduled: {
              type: "timestamp",
              isActive: true,
              year: 2026,
              month: 5,
              day: 10,
            },
            deadline: {
              type: "timestamp",
              isActive: true,
              year: 2026,
              month: 5,
              day: 12,
              time: "10:00",
            },
          },
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Meeting is set for " },
            {
              type: "timestamp",
              isActive: false,
              year: 2026,
              month: 5,
              day: 8,
              time: "15:00",
            },
            { type: "text", value: "." },
          ],
        },
      ],
    });
  });

  it("parses comments and footnotes", () => {
    const input = [
      "  # Comment about the doc",
      "See [fn:1] for details.",
      "[fn:1] Footnote *detail*.",
    ].join("\n");

    expect(parse(input)).toMatchObject({
      children: [
        {
          type: "comment",
          content: "Comment about the doc",
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "See " },
            {
              type: "footnote-reference",
              label: "1",
            },
            { type: "text", value: " for details." },
          ],
        },
        {
          type: "footnote-definition",
          label: "1",
          children: [
            { type: "text", value: "Footnote " },
            {
              type: "bold",
              children: [{ type: "text", value: "detail" }],
            },
            { type: "text", value: "." },
          ],
        },
      ],
    });
  });

  it("parses document metadata into root metadata", () => {
    const input = [
      "#+TITLE: Org Mode Parsing",
      "#+author: Alice",
      "#+DATE: 2026-05-06",
      "",
      "* Heading",
    ].join("\n");

    expect(parse(input)).toMatchObject({
      metadata: {
        TITLE: "Org Mode Parsing",
        AUTHOR: "Alice",
        DATE: "2026-05-06",
      },
      children: [
        {
          type: "heading",
          properties: {},
          children: [{ type: "text", value: "Heading" }],
        },
      ],
    });
  });

  it("parses unordered lists into a single list node", () => {
    const ast = parse("- Item A\n+ Item B");

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({
      type: "list",
      kind: "unordered",
      children: [
        {
          type: "list-item",
          marker: "-",
          checkbox: null,
          children: [
            {
              type: "text",
              value: "Item A",
            },
          ],
        },
        {
          type: "list-item",
          marker: "+",
          checkbox: null,
          children: [
            {
              type: "text",
              value: "Item B",
            },
          ],
        },
      ],
    });
  });

  it("parses inline markup inside paragraphs", () => {
    const ast = parse("Plain *bold* /italic/ =code= ~verb~ +strike+ _under_");

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "Plain " },
        {
          type: "bold",
          children: [{ type: "text", value: "bold" }],
        },
        { type: "text", value: " " },
        {
          type: "italic",
          children: [{ type: "text", value: "italic" }],
        },
        { type: "text", value: " " },
        { type: "code", value: "code" },
        { type: "text", value: " " },
        { type: "verbatim", value: "verb" },
        { type: "text", value: " " },
        {
          type: "strike-through",
          children: [{ type: "text", value: "strike" }],
        },
        { type: "text", value: " " },
        {
          type: "underline",
          children: [{ type: "text", value: "under" }],
        },
      ],
    });
  });

  it("parses links with inline descriptions", () => {
    const ast = parse("See [[https://github.com][*GitHub*]] now");

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "See " },
        {
          type: "link",
          url: "https://github.com",
          description: [
            {
              type: "bold",
              children: [{ type: "text", value: "GitHub" }],
            },
          ],
        },
        { type: "text", value: " now" },
      ],
    });
  });

  it("parses case-insensitive source blocks", () => {
    const input = ["#+begin_src typescript", "console.log('hi');", "#+end_src"].join("\n");

    expect(parse(input)).toMatchObject({
      children: [
        {
          type: "block",
          blockName: "SRC",
          parameters: "typescript",
          content: "\nconsole.log('hi');\n",
          position: {
            start: { index: 0, line: 1, column: 1 },
            end: { index: input.length, line: 3, column: 10 },
          },
        },
      ],
    });
  });

  it("parses ordered lists into a single list node", () => {
    const ast = parse("1. First\n2) Second");

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({
      type: "list",
      kind: "ordered",
      children: [
        {
          type: "list-item",
          marker: "1.",
          checkbox: null,
          children: [
            {
              type: "text",
              value: "First",
            },
          ],
        },
        {
          type: "list-item",
          marker: "2)",
          checkbox: null,
          children: [
            {
              type: "text",
              value: "Second",
            },
          ],
        },
      ],
    });
  });

  it("parses checkbox list items", () => {
    const ast = parse("- [ ] Todo\n- [X] Done");

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({
      type: "list",
      kind: "unordered",
      children: [
        {
          type: "list-item",
          marker: "-",
          checkbox: "unchecked",
          children: [
            {
              type: "text",
              value: "Todo",
            },
          ],
        },
        {
          type: "list-item",
          marker: "-",
          checkbox: "checked",
          children: [
            {
              type: "text",
              value: "Done",
            },
          ],
        },
      ],
    });
  });

  it("parses org tables into a single table node", () => {
    const ast = parse(
      "| Name  | Age | Role      |\n|-------+-----+-----------|\n| Alice | 24  | Engineer  |\n| Bob   | 30  | Designer  |",
    );

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({
      type: "table",
      children: [
        {
          type: "table-row",
          rowType: "data",
          children: [
            { type: "table-cell", children: [{ type: "text", value: "Name" }] },
            { type: "table-cell", children: [{ type: "text", value: "Age" }] },
            { type: "table-cell", children: [{ type: "text", value: "Role" }] },
          ],
        },
        {
          type: "table-row",
          rowType: "separator",
          children: [],
        },
        {
          type: "table-row",
          rowType: "data",
          children: [
            { type: "table-cell", children: [{ type: "text", value: "Alice" }] },
            { type: "table-cell", children: [{ type: "text", value: "24" }] },
            { type: "table-cell", children: [{ type: "text", value: "Engineer" }] },
          ],
        },
        {
          type: "table-row",
          rowType: "data",
          children: [
            { type: "table-cell", children: [{ type: "text", value: "Bob" }] },
            { type: "table-cell", children: [{ type: "text", value: "30" }] },
            { type: "table-cell", children: [{ type: "text", value: "Designer" }] },
          ],
        },
      ],
    });
  });

  it("does not misread arithmetic and paths as inline markup", () => {
    // org-mode requires emphasis markers to sit on word/punctuation borders.
    // `2 * 3 * 4` must stay plain text, not become bold.
    const arithmetic = parse("2 * 3 * 4");
    expect(arithmetic.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "2 * 3 * 4" }],
    });

    // Underscores inside identifiers are not underline markers.
    const identifier = parse("snake_case_value");
    expect(identifier.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "snake_case_value" }],
    });

    // Slashes inside file paths are not italic markers.
    const filePath = parse("see /etc/hosts now");
    expect(filePath.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "see /etc/hosts now" }],
    });

    // Content cannot start or end with a border character.
    const padded = parse("x * bold * y");
    expect(padded.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "x * bold * y" }],
    });
  });

  it("parses emphasis with valid borders", () => {
    const ast = parse("use *bold* and /italic/ and =code= here");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "use " },
        { type: "bold", children: [{ type: "text", value: "bold" }] },
        { type: "text", value: " and " },
        { type: "italic", children: [{ type: "text", value: "italic" }] },
        { type: "text", value: " and " },
        { type: "code", value: "code" },
        { type: "text", value: " here" },
      ],
    });
  });

  it("stores a normalized weekday on timestamps that include one", () => {
    const ast = parse("Meeting [2026-05-12 Mon] now");
    const paragraph = ast.children[0];
    expect(paragraph?.type).toBe("paragraph");
    if (paragraph?.type !== "paragraph") {
      return;
    }

    const timestamp = paragraph.children.find((child) => child.type === "timestamp");
    // The source wrote "Mon" but 2026-05-12 is a Tuesday; the parser normalizes.
    expect(timestamp).toMatchObject({ type: "timestamp", weekday: "Tue" });
  });

  // --- Issue #84: horizontal rule and hard break ---

  it("parses a horizontal rule (five or more dashes) into a horizontal-rule node", () => {
    const ast = parse(["before", "", "-----", "", "after"].join("\n"));
    expect(ast.children.map((child) => child.type)).toEqual([
      "paragraph",
      "horizontal-rule",
      "paragraph",
    ]);
  });

  it("parses longer dash runs as a horizontal rule", () => {
    const ast = parse("--------");
    expect(ast.children[0]?.type).toBe("horizontal-rule");
  });

  it("does not treat a four-dash line as a horizontal rule", () => {
    const ast = parse("----");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "----" }],
    });
  });

  it("parses a trailing backslash as a hard break inside a paragraph", () => {
    const ast = parse("line one\\\nline two");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "line one" },
        { type: "hard-break" },
        { type: "text", value: "line two" },
      ],
    });
  });

  it("parses a trailing backslash followed by a newline as a hard break", () => {
    const ast = parse("line one\\\nline two");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", value: "line one" },
        { type: "hard-break" },
        { type: "text", value: "line two" },
      ],
    });
  });

  it("treats a backslash at the very end of input as a literal backslash", () => {
    const ast = parse("last line\\");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "last line\\" }],
    });
  });

  it("does not treat an inline backslash as a hard break", () => {
    const ast = parse("a\\b");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "a\\b" }],
    });
  });

  // --- Issue #83: nested lists ---

  it("parses nested unordered lists into subList structure", () => {
    const input = ["- parent", "  - child", "    - grandchild", "  - sibling", "- top2"].join(
      "\n",
    );
    const ast = parse(input);
    const list = ast.children[0];
    expect(list?.type).toBe("list");
    if (list?.type !== "list") {
      return;
    }

    expect(list.children).toHaveLength(2);
    const parent = list.children[0];
    if (parent === undefined) {
      return;
    }
    expect(parent).toMatchObject({ type: "list-item", marker: "-" });
    expect(parent.children[0]).toMatchObject({ type: "text", value: "parent" });

    expect(parent.subList).toMatchObject({ type: "list", kind: "unordered" });
    expect(parent.subList?.children).toHaveLength(2);
    expect(parent.subList?.children[1]).toMatchObject({
      type: "list-item",
      children: [{ type: "text", value: "sibling" }],
    });

    const child = parent.subList?.children[0];
    expect(child?.children[0]).toMatchObject({ type: "text", value: "child" });
    expect(child?.subList?.children[0]).toMatchObject({
      type: "list-item",
      children: [{ type: "text", value: "grandchild" }],
    });
  });

  it("parses a mix of ordered and nested unordered lists", () => {
    const input = ["1. first", "  - sub a", "  - sub b", "2. second"].join("\n");
    const ast = parse(input);
    const list = ast.children[0];
    expect(list?.type).toBe("list");
    if (list?.type !== "list") {
      return;
    }

    expect(list.kind).toBe("ordered");
    expect(list.children).toHaveLength(2);
    expect(list.children[0]?.subList?.kind).toBe("unordered");
    expect(list.children[0]?.subList?.children).toHaveLength(2);
    expect(list.children[1]?.subList).toBeUndefined();
  });

  it("parses a checkbox item with a nested list", () => {
    const input = ["- [ ] parent", "  - child"].join("\n");
    const ast = parse(input);
    const list = ast.children[0];
    expect(list?.type).toBe("list");
    if (list?.type !== "list") {
      return;
    }

    expect(list.children[0]).toMatchObject({
      type: "list-item",
      checkbox: "unchecked",
    });
    expect(list.children[0]?.subList?.children[0]).toMatchObject({
      type: "list-item",
      children: [{ type: "text", value: "child" }],
    });
  });

  // --- Issue #86: backslash escape un-escaping ---

  it("un-escapes backslash-escaped emphasis markers in text", () => {
    const ast = parse("not *bold\\* but plain");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "not *bold* but plain" }],
    });
  });

  it("un-escapes backslash-escaped markers inside code and verbatim", () => {
    const ast = parse("=a\\=b= and ~c\\~d~");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "code", value: "a=b" },
        { type: "text", value: " and " },
        { type: "verbatim", value: "c~d" },
      ],
    });
  });

  it("does not treat an escaped opening marker as emphasis", () => {
    const ast = parse("\\*not bold\\*");
    expect(ast.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "*not bold*" }],
    });
  });
});
