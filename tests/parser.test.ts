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
});
