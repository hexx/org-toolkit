import { describe, expect, it } from "vitest";
import { parse, walk } from "../src/index.js";

describe("walk", () => {
  it("visits the AST depth-first with parent context", () => {
    const input = [
      "#+TITLE: Traversal Demo",
      "* TODO Build report :work:",
      "SCHEDULED: <2026-05-10 Sun>",
      "Plan includes /analysis/ and [[https://example.com][*Docs*]] plus [2026-05-08 Fri 15:00].",
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
    expect(visits).toContainEqual({ type: "heading", parent: "root", depth: 1 });
    expect(visits).toContainEqual({ type: "timestamp", parent: "heading", depth: 2 });
    expect(visits).toContainEqual({ type: "paragraph", parent: "root", depth: 1 });
    expect(visits).toContainEqual({ type: "italic", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "link", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "timestamp", parent: "paragraph", depth: 2 });
    expect(visits).toContainEqual({ type: "list-item", parent: "list", depth: 2 });
    expect(visits).toContainEqual({ type: "table-cell", parent: "table-row", depth: 3 });
    expect(visits).toContainEqual({ type: "block", parent: "root", depth: 1 });
  });
});
