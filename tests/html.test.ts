import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { toHtml } from "../src/exporters/html.js";

describe("toHtml", () => {
  it("converts parsed org content to semantic HTML", () => {
    const input = [
      "#+TITLE: Org Mode Parsing",
      "",
      "* TODO Project <Plan> :work:urgent:",
      "",
      "- [ ] Research /background/",
      "- [X] Implement =core=",
      "",
      "See [[https://github.com][*GitHub*]] & friends",
      "",
      "| Name  | Age | Role     |",
      "|-----+---+--------|",
      "| Alice | 24  | Engineer |",
      "| Bob   | 30  | Designer |",
    ].join("\n");

    expect(toHtml(parse(input))).toBe(
      [
        '<meta name="title" content="Org Mode Parsing">',
        "",
        "<h1>TODO Project &lt;Plan&gt;</h1>",
        "",
        "<ul><li><input type=\"checkbox\" disabled> Research <em>background</em></li><li><input type=\"checkbox\" disabled checked> Implement <code>core</code></li></ul>",
        "",
        '<p>See <a href="https://github.com"><strong>GitHub</strong></a> &amp; friends</p>',
        "",
        "<table><thead><tr><th scope=\"col\">Name</th><th scope=\"col\">Age</th><th scope=\"col\">Role</th></tr></thead><tbody><tr><td>Alice</td><td>24</td><td>Engineer</td></tr><tr><td>Bob</td><td>30</td><td>Designer</td></tr></tbody></table>",
      ].join("\n"),
    );
  });

  it("escapes unsafe link URLs instead of emitting anchors", () => {
    const html = toHtml(
      parse("Link [[javascript:alert(1)][<unsafe>]]"),
    );

    expect(html).toBe('<p>Link &lt;unsafe&gt;</p>');
  });

  it("renders a horizontal rule as <hr>", () => {
    expect(toHtml(parse(["before", "", "-----", "", "after"].join("\n")))).toBe(
      ["<p>before</p>", "", "<hr>", "", "<p>after</p>"].join("\n"),
    );
  });

  it("renders a hard break as <br>", () => {
    expect(toHtml(parse("a\\\nb"))).toBe("<p>a<br>b</p>");
  });

  it("renders nested lists as nested <ul> elements", () => {
    expect(toHtml(parse(["- parent", "  - child"].join("\n")))).toBe(
      "<ul><li>parent <ul><li>child</li></ul></li></ul>",
    );
  });
});
