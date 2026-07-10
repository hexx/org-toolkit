---
"org-toolkit": minor
---

Escape delimiter characters in `stringify` so builder-constructed ASTs round-trip
safely through `parse`. Emphasis, code, verbatim, and link-description content
now escapes the surrounding delimiter characters (and backslashes) when
stringified, preventing characters like `*`, `=`, `]`, or `\` inside content
from being misread as markup on re-parse.

The parser always un-escapes `\` followed by a delimiter character
(`* / _ + = ~ [ ] \`), so `*a\*b*` parses to bold text containing `a*b`, and
`stringify` produces `*a\*b*` again — keeping `parse(stringify(ast))` stable
for both source-parsed and builder-built ASTs.

Pass `{ escapeDelimiters: false }` to `stringify` to disable escaping when the
output will not be re-parsed (for example, when emitting to a system that
handles its own escaping).
