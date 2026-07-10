import { describe, expect, it } from "vitest";
import {
  createBold,
  createHardBreak,
  createHeading,
  createHorizontalRule,
  createItalic,
  createLink,
  createList,
  createListItem,
  createParagraph,
  createPlainText,
  createRoot,
  createTimestamp,
  stringify,
} from "../src/index.js";

describe("builders", () => {
  it("builds a clean org document that stringifies well", () => {
    const ast = createRoot(
      {
        TITLE: "Builder Demo",
        AUTHOR: "Copilot",
      },
      [
        createHeading(1, "Ship the package", {
          todoKeyword: "TODO",
          tags: ["work", "urgent"],
        }),
        createParagraph([
          createPlainText("Use "),
          createBold("bold"),
          createPlainText(" or "),
          createItalic("italic"),
          createPlainText(" text, visit "),
          createLink("https://github.com", [createBold("GitHub")]),
          createPlainText(" or "),
          createLink("https://example.com"),
          createPlainText(" at "),
          createTimestamp(new Date(Date.UTC(2026, 4, 29, 7, 10)), { withTime: true }),
        ]),
        createList("unordered", [
          createListItem("Draft docs", { checkbox: "unchecked" }),
          createListItem("Ship it", { checkbox: "checked" }),
        ]),
        createList("ordered", [
          createListItem("First step"),
          createListItem("Second step"),
        ]),
      ],
    );

    expect(stringify(ast)).toBe(
      [
        "#+TITLE: Builder Demo",
        "#+AUTHOR: Copilot",
        "",
        "* TODO Ship the package :work:urgent:",
        "",
        "Use *bold* or /italic/ text, visit [[https://github.com][*GitHub*]] or [[https://example.com]] at <2026-05-29 07:10>",
        "",
        "- [ ] Draft docs",
        "- [X] Ship it",
        "",
        "1. First step",
        "1. Second step",
      ].join("\n"),
    );
  });

  it("builds a list item with a nested sub-list", () => {
    const ast = createRoot(
      {},
      [
        createList("unordered", [
          createListItem("parent", {
            subList: createList("unordered", [createListItem("child")]),
          }),
        ]),
      ],
    );
    expect(stringify(ast)).toBe(["- parent", "  - child"].join("\n"));
  });

  it("builds horizontal rule and hard break nodes", () => {
    const ast = createRoot(
      {},
      [
        createParagraph([createPlainText("a"), createHardBreak(), createPlainText("b")]),
        createHorizontalRule(),
      ],
    );
    expect(stringify(ast)).toBe(["a\\", "b", "", "-----"].join("\n"));
  });
});
