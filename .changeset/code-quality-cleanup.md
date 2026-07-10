---
"org-toolkit": minor
---

Improve parser correctness, remove hidden AST state, and clean up internal
duplication.

**Inline markup now respects org-mode border rules.** Emphasis markers
(`*`, `/`, `_`, `+`, `=`, `~`) must sit on word/punctuation borders and the
content cannot start or end with a border character, matching Emacs'
`org-emphasis-regexp-components`. This fixes misreads such as `2 * 3 * 4`
being parsed as bold, `snake_case` as underline, or `/etc/hosts` as italic.

**Timestamps carry a `weekday` field.** Parsed timestamps that include a
day-of-week label now store a normalized `weekday` string (e.g. `"Sun"`) on
`TimestampNode`. The label is computed from the date, so incorrect source
labels are corrected. Builder-created timestamps omit it and render without a
weekday, as before.

**Removed hidden AST properties.** Parser-to-stringifier side channels
(recorded raw planning lines and inter-block blank-line counts) moved from
non-enumerable properties on AST nodes to a WeakMap store. AST objects now
contain only the fields declared in the type definitions, so `JSON.stringify`,
deep equality, and the playground AST view are accurate.

**`stringify` accepts options.** `stringify(node, { alignTags })` aligns
heading tag groups to a column (used by `format`'s tag alignment, replacing
the previous string post-processing).

**Breaking:**
- Removed the `Parser` class export. Use the `parse` function directly:
  `Parser.parse(text)` → `parse(text)`.
- `TimestampNode` gained an optional `weekday` field. Code that constructs
  timestamps by hand can ignore it; `stringify` renders it only when present.
- `format()` now normalizes blank lines between top-level blocks to a single
  separator (previously preserved the source count via hidden state).

**CLI:** Argument parsing moved to Node's `util.parseArgs`. Unknown flags now
error instead of being silently ignored, conflicting output flags are
rejected, and unhandled rejections are caught.

**Internal:** Deduplicated `assertNever`, `pad2`, date formatting,
`joinTopLevelChildren`, and `stripBlockBoundaryNewlines` into shared helpers
under `src/internal/`. `resolveTodos` no longer uses a `as MutableHeading`
cast — it builds fresh heading nodes. Added an `oxlint` config, `npm run lint`
script, and a CI lint step.
