import { describe, expect, it } from "vitest";
import { findAllByType, findHeadingsByTag, findTodos, parse } from "../src/index.js";

describe("query helpers", () => {
  it("finds headings and timestamps by common predicates", () => {
    const input = [
      "* TODO Build report :work:",
      "SCHEDULED: <2026-05-10 Sun>",
      "Report due [2026-05-08 Fri 15:00].",
      "",
      "* DONE Finish report :work:done:",
      "",
      "* TODO Write docs :docs:",
    ].join("\n");

    const ast = parse(input);

    expect(findAllByType(ast, "heading")).toHaveLength(3);
    expect(findAllByType(ast, "timestamp")).toHaveLength(2);
    expect(findTodos(ast).map((heading) => heading.children[0]?.type === "text" ? heading.children[0].value : "")).toEqual([
      "Build report",
      "Write docs",
    ]);
    expect(findHeadingsByTag(ast, "work").map((heading) => heading.children[0]?.type === "text" ? heading.children[0].value : "")).toEqual([
      "Build report",
      "Finish report",
    ]);
  });
});
