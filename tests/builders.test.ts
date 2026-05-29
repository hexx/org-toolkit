import { describe, expect, it } from "vitest";
import {
  createHeading,
  createList,
  createListItem,
  createParagraph,
  createPlainText,
  createRoot,
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
        createParagraph("Plan the package"),
        createParagraph([createPlainText("Inline"), createPlainText(" "), createPlainText("nodes")]),
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
        "Plan the package",
        "",
        "Inline nodes",
        "",
        "- [ ] Draft docs",
        "- [X] Ship it",
        "",
        "1. First step",
        "1. Second step",
      ].join("\n"),
    );
  });
});
