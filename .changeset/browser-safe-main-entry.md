---
"org-toolkit": minor
---

Separate Node-only file-system/CLI code from the main entry so `org-toolkit`
can be bundled for browsers and edge runtimes (Cloudflare Workers, Vite browser
builds) without pulling in `node:fs` or `node:path`.

The public `.` entry no longer statically depends on Node built-ins. File-system
helpers moved to a dedicated `org-toolkit/file-system` subpath:

```ts
// Browser/Worker-safe (unchanged import path)
import { parse, format, stringify, toHtml, toMarkdown } from "org-toolkit";

// Node-only file/glob helpers — now imported from the file-system subpath
import { formatFiles, resolveOrgFiles } from "org-toolkit/file-system";
```

**Breaking:** `formatFiles` and `resolveOrgFiles` are no longer exported from
the main `org-toolkit` entry. Update imports to `org-toolkit/file-system`.
`format(text)` (pure, Node-independent) remains on the main entry.
