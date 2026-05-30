# org-toolkit

Parse, transform, and export Emacs org-mode documents in TypeScript.

## Install

```bash
npm install org-toolkit
```

## Usage

### Parse and export

```ts
import { parse, toMarkdown, toHtml } from "org-toolkit";

const source = [
  "#+TITLE: Notes",
  "",
  "* TODO Write docs :work:",
  "- [ ] Draft README",
].join("\n");

const ast = parse(source);

console.log(toMarkdown(ast));
console.log(toHtml(ast));
```

### AST structure

`org-toolkit` keeps block structure and inline formatting separate so external apps can render, search, and transform the tree without re-parsing text.

```text
root
├─ document metadata
├─ heading
│  ├─ planning
│  ├─ tags[]
│  └─ inline nodes
├─ paragraph
│  └─ inline nodes
├─ list
│  └─ list-item
│     └─ inline nodes
├─ block
├─ table
│  └─ table-row
│     └─ table-cell
│        └─ inline nodes
├─ footnote-definition
│  └─ inline nodes
└─ comment
```

### Plain text extraction

Use `getTextContent()` when you need a readable label for search indexes, mind maps, or sidebars.

```ts
import { getTextContent, parse } from "org-toolkit";

const ast = parse([
  "#+TITLE: Notes",
  "",
  "* TODO Capture ideas :mindmap:",
  "The *fast* /notes/ are on [[https://github.com][GitHub]].",
  "Meeting is set for [2026-05-08 Fri 15:00].",
].join("\n"));

console.log(getTextContent(ast));
// Capture ideas
// The fast notes are on GitHub.
// Meeting is set for 2026-05-08 15:00.
```

### Extract and walk specific node types

`findAllByType()` is the simplest way to collect only one node kind. `walk()` is better when you need the full tree plus parent/depth context.

```ts
import { findAllByType, findHeadingsByTag, findTodos, parse, walk } from "org-toolkit";

const ast = parse([
  "* TODO Ship docs :work:",
  "",
  "- [ ] Draft README",
].join("\n"));

const headings = findAllByType(ast, "heading");
const todos = findTodos(ast);
const workHeadings = findHeadingsByTag(ast, "work");

walk(ast, (node, context) => {
  if (node.type === "heading") {
    console.log(context.depth, node.children.length);
  }
});
```

### Rewrite the AST

```ts
import { applyPlugins, parse, resolveTodos, stripTags, stringify } from "org-toolkit";

const ast = parse([
  "* TODO Publish release :public:",
  "* TODO Draft internal notes :private:",
].join("\n"));

const next = applyPlugins(ast, [
  resolveTodos(new Date("2026-05-08T12:34:00Z")),
  stripTags(["private"]),
]);

console.log(stringify(next));
```

### Builder recipes

Build ASTs directly when an external app already owns the structure.

```ts
import {
  createBold,
  createHeading,
  createItalic,
  createLink,
  createParagraph,
  createPlainText,
  createRoot,
  createTimestamp,
  stringify,
} from "org-toolkit";

const ast = createRoot(
  { TITLE: "Release plan" },
  [
    createHeading(1, "Ship docs", {
      todoKeyword: "TODO",
      tags: ["work", "urgent"],
    }),
    createParagraph([
      createPlainText("Review "),
      createBold("notes"),
      createPlainText(" and "),
      createItalic("feedback"),
      createPlainText(" at "),
      createTimestamp(new Date(Date.UTC(2026, 4, 29, 7, 10)), { withTime: true }),
      createPlainText(" via "),
      createLink("https://github.com", [createBold("GitHub")]),
    ]),
  ],
);

console.log(stringify(ast));
```

#### TODO status, tags, and timestamps

```ts
import { createHeading, createTimestamp, stringify } from "org-toolkit";

const heading = createHeading(1, "Prepare release", {
  todoKeyword: "TODO",
  tags: ["work", "release"],
});

const scheduled = createTimestamp(new Date(Date.UTC(2026, 4, 29)), {
  withTime: false,
});

console.log(stringify(heading));
// * TODO Prepare release :work:release:

console.log(scheduled);
// { type: "timestamp", isActive: true, year: 2026, month: 5, day: 29, ... }
```

### CLI

```bash
npx org-toolkit sample.org
npx org-toolkit --format sample.org
npx org-toolkit --format --write sample.org
npx org-toolkit --markdown sample.org
npx org-toolkit --html sample.org
```

### Agenda

```bash
npx org-toolkit --agenda ./my-notes
npx org-toolkit --agenda "docs/**/*.org"
```

### Web playground

```bash
cd playground
npm install
npm run dev
```

### External consumer example

```bash
npm run build
npm pack
cd examples/consumer
npm install ../../org-toolkit-0.1.0.tgz
npm run start
```
