---
"org-toolkit": minor
---

Export `parseInline` as a public API. It parses org-mode inline markup
(bold, italic, code, links, timestamps, footnote references, hard breaks, and
backslash escapes) into `InlineNode[]` without any surrounding block structure,
letting applications that manage their own block layout delegate only inline
decoration to org-toolkit.

The `startPosition` argument is now optional and defaults to a zero position
when omitted, which is convenient for callers that do not track source
offsets:

```ts
import { parseInline } from "org-toolkit";

const nodes = parseInline("hello *bold* and [[https://example.com][link]]");
// → [TextNode, BoldNode, TextNode, LinkNode]
```
