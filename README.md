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

### Search the AST

```ts
import { findTodos, parse, walk } from "org-toolkit";

const todos = findTodos(parse("* TODO Ship it"));
console.log(todos.map((heading) => heading.todoKeyword));

walk(parse("* TODO Ship it"), (node, context) => {
  console.log(node.type, context.depth);
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

### CLI

```bash
npx org-toolkit sample.org
npx org-toolkit --markdown sample.org
npx org-toolkit --html sample.org
```

### Agenda

```bash
npx org-toolkit --agenda ./my-notes
npx org-toolkit --agenda "docs/**/*.org"
```
