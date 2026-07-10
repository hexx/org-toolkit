import { describe, expect, it } from "vitest";
import {
  createBold,
  createLink,
  createParagraph,
  createPlainText,
  createTimestamp,
  getTextContent,
  parse,
} from "../src/index.js";

describe("getTextContent", () => {
  it("extracts readable text and strips inline markup", () => {
    const ast = parse(
      [
        "#+TITLE: Notes",
        "",
        "* TODO Capture ideas :mindmap:",
        "The *fast* /notes/ are on [[https://github.com][GitHub]] and [[https://example.com]].",
        "Meeting is set for [2026-05-08 Fri 15:00].",
      ].join("\n"),
    );

    expect(getTextContent(ast)).toBe(
      [
        "Capture ideas",
        "The fast notes are on GitHub and https://example.com.",
        "Meeting is set for 2026-05-08 15:00.",
      ].join("\n"),
    );
  });

  it("prefers link descriptions and normalizes timestamps from builders", () => {
    const paragraph = createParagraph([
      createPlainText("Read "),
      createLink("https://github.com", [createBold("GitHub")]),
      createPlainText(" at "),
      createTimestamp(new Date(Date.UTC(2026, 4, 29, 7, 10)), { withTime: true }),
    ]);

    expect(getTextContent(paragraph)).toBe("Read GitHub at 2026-05-29 07:10");
  });

  it("extracts text from nested lists", () => {
    expect(getTextContent(parse(["- parent", "  - child"].join("\n")))).toBe(
      "parent\nchild",
    );
  });

  it("renders empty text for horizontal rules and hard breaks", () => {
    expect(getTextContent(parse("-----"))).toBe("");
    expect(getTextContent(parse("a\\\nb"))).toBe("a\nb");
  });
});
