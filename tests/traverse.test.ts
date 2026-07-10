import { describe, expect, it } from "vitest";
import { parse, walk } from "../src/index.js";

describe("walk", () => {
  it("visits the AST depth-first with parent context", () => {
    const input = [
      "#+TITLE: Traversal Demo",
      "# Comment about the doc",
      "* TODO Build report :work:",
      "SCHEDULED: <2026-05-10 Sun>",
      "Plan includes /analysis/ and [[https://example.com][*Docs*]] plus [2026-05-08 Fri 15:00].",
      "See [fn:1] for details.",
      "",
      "[fn:1] Footnote *detail*.",
      "- [ ] Draft *intro*",
      "| Name | Role |",
      "|------+------|",
      "| Alice | Lead |",
      "#+BEGIN_SRC typescript",
      "console.log('hi');",
      "#+END_SRC",
    ].join("\n");

    const ast = parse(input);
    const visits: Array<{ type: string; parent: string | undefined; depth: number }> = [];

    walk(ast, (node, context) => {
      visits.push({
        type: node.type,
        parent: context.parent?.type,
        depth: context.depth,
      });
    });

    expect(visits[0]).toEqual({ type: "root", parent: undefined, depth: 0 });
    expect(visits).toContainEqual({ type: "comment", parent: "root", depth: 1 });
    expect(visits).toContainEqual({ type: "heading", parent: "root", depth: 1 });
    expect(visits).toContainEqual({ type: "timestamp", parent: "heading", depth: 2 });
    expect(visits).toContainEqual({ type: "paragraph", parent: "root", depth: 1 });
    expect(visits).toContainEqual({ type: "italic", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "link", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "timestamp", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "footnote-reference", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "footnote-definition", parent: "root", depth: 1 });
    expect(visits).toContainEqual({ type: "list-item", parent: "list", depth: 2 });
    expect(visits).toContainEqual({ type: "table-cell", parent: "table-row", depth: 3 });
    expect(visits).toContainEqual({ type: "block", parent: "root", depth: 1 });
  });

  it("visits nested sub-lists under their parent list item", () => {
    const ast = parse(["- parent", "  - child"].join("\n"));
    const visits: string[] = [];
    walk(ast, (node) => {
      visits.push(node.type);
    });
    expect(visits).toEqual([
      "root",
      "list",
      "list-item",
      "text",
      "list",
      "list-item",
      "text",
    ]);
  });

  it("visits horizontal-rule and hard-break nodes", () => {
    const ast = parse(["a\\", "b", "", "-----"].join("\n"));
    const visits: string[] = [];
    walk(ast, (node) => {
      visits.push(node.type);
    });
    expect(visits).toContain("hard-break");
    expect(visits).toContain("horizontal-rule");
  });
});
