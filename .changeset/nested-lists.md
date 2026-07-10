---
"org-toolkit": minor
---

Support nested lists in the AST. `ListItem` now has an optional `subList: List`
field that holds an indented sub-list parsed from the source. Lists are parsed
into a tree based on indentation levels (two spaces per nesting level), so:

```org
- parent
  - child
    - grandchild
  - sibling
- top2
```

becomes a single `List` whose first item carries a `subList` (itself containing
a nested `subList`). Stringifying, `toHtml`, `toMarkdown`, `getTextContent`,
and `walk` all traverse the nested structure, so round-trips and exports
preserve nesting. The `createListItem` builder accepts an optional `subList`
option for constructing nested lists programmatically.
