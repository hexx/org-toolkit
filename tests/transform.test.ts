import { describe, expect, it } from "vitest";
import { applyPlugins, parse, resolveTodos, stripTags, stringify, toMarkdown } from "../src/index.js";

describe("transform", () => {
  it("resolves TODO headings without mutating the original AST", () => {
    const input = [
      "* TODO Publish release",
      "",
      "* DONE Keep existing",
    ].join("\n");

    const ast = parse(input);
    const next = applyPlugins(ast, [resolveTodos(new Date("2026-05-08T12:34:00Z"))]);

    expect(next).not.toBe(ast);
    expect(stringify(ast)).toBe(input);
    // resolveTodos must not mutate the original AST nodes (no readonly cast).
    const originalHeading = ast.children[0];
    expect(originalHeading?.type).toBe("heading");
    if (originalHeading?.type === "heading") {
      expect(originalHeading.todoKeyword).toBe("TODO");
      expect(originalHeading.planning).toBeUndefined();
    }
    expect(stringify(next)).toBe(
      [
        "* DONE Publish release",
        "CLOSED: <2026-05-08 12:34>",
        "",
        "* DONE Keep existing",
      ].join("\n"),
    );
    expect(toMarkdown(next)).toBe(
      [
        "# DONE Publish release",
        "**CLOSED:** 2026-05-08 12:34",
        "",
        "# DONE Keep existing",
      ].join("\n"),
    );
  });

  it("strips tagged headings while preserving untouched source annotations", () => {
    const input = [
      "* DONE Keep existing",
      "SCHEDULED: <2026-05-10 Sun>",
      "",
      "* TODO Remove this :secret:private:",
    ].join("\n");

    const ast = parse(input);
    const next = applyPlugins(ast, [stripTags(["secret", "private"])]);

    expect(next).not.toBe(ast);
    expect(stringify(ast)).toBe(input);
    expect(stringify(next)).toBe(
      [
        "* DONE Keep existing",
        "SCHEDULED: <2026-05-10 Sun>",
      ].join("\n"),
    );
    expect(toMarkdown(next)).toBe(
      [
        "# DONE Keep existing",
        "**SCHEDULED:** 2026-05-10",
      ].join("\n"),
    );
  });
});
