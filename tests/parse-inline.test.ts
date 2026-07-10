import { describe, expect, it } from "vitest";
import { parseInline } from "../src/index.js";

describe("parseInline (Issue #85)", () => {
  it("is exported and parses plain text into a single text node", () => {
    const nodes = parseInline("hello world");
    expect(nodes).toEqual([
      {
        type: "text",
        value: "hello world",
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 11, line: 1, column: 12 },
        },
      },
    ]);
  });

  it("parses bold, italic and code inline markup", () => {
    const nodes = parseInline("use *bold* and /italic/ and =code=");
    expect(nodes.map((node) => node.type)).toEqual([
      "text",
      "bold",
      "text",
      "italic",
      "text",
      "code",
    ]);
  });

  it("parses a link with description", () => {
    const nodes = parseInline("[[https://example.com][a link]]");
    expect(nodes).toMatchObject([
      {
        type: "link",
        url: "https://example.com",
        description: [{ type: "text", value: "a link" }],
      },
    ]);
  });

  it("uses the provided startPosition to compute node positions", () => {
    const nodes = parseInline("*x*", { index: 10, line: 2, column: 5 });
    expect(nodes[0]?.position.start).toEqual({ index: 10, line: 2, column: 5 });
  });

  it("defaults to the zero position when startPosition is omitted", () => {
    const nodes = parseInline("ab");
    expect(nodes[0]?.position.start).toEqual({ index: 0, line: 1, column: 1 });
    expect(nodes[0]?.position.end).toEqual({ index: 2, line: 1, column: 3 });
  });

  it("un-escapes backslash-escaped delimiters", () => {
    const nodes = parseInline("\\*not bold\\*");
    expect(nodes).toEqual([
      {
        type: "text",
        value: "*not bold*",
        position: {
          start: { index: 0, line: 1, column: 1 },
          end: { index: 12, line: 1, column: 13 },
        },
      },
    ]);
  });

  it("parses a hard break from a trailing backslash", () => {
    const nodes = parseInline("a\\\nb");
    expect(nodes.map((node) => node.type)).toEqual(["text", "hard-break", "text"]);
  });
});
