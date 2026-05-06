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
            { type: "table-cell", value: "Name" },
            { type: "table-cell", value: "Age" },
            { type: "table-cell", value: "Role" },
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
            { type: "table-cell", value: "Alice" },
            { type: "table-cell", value: "24" },
            { type: "table-cell", value: "Engineer" },
          ],
        },
        {
          type: "table-row",
          rowType: "data",
          children: [
            { type: "table-cell", value: "Bob" },
            { type: "table-cell", value: "30" },
            { type: "table-cell", value: "Designer" },
          ],
        },
      ],
    });
  });
});
