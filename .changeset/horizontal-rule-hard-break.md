---
"org-toolkit": minor
---

Support horizontal rules and hard breaks. A line of five or more dashes
(`-----`) parses to a new block-level `HorizontalRuleNode` (`type:
"horizontal-rule"`) stored in `Root.children`. A trailing backslash followed
by a newline inside a paragraph parses to an inline `HardBreakNode` (`type:
"hard-break"`), matching Emacs org-mode.

Exporters render these accordingly: `toHtml` emits `<hr>` and `<br>`, `toMarkdown`
emits `---` and two trailing spaces, and `stringify` round-trips the original
org syntax (`-----` and a trailing `\`). `getTextContent` returns an empty
string for a horizontal rule and a newline for a hard break. The
`createHorizontalRule` and `createHardBreak` builders are available for
programmatic construction.
