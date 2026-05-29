// Local integration test:
// 1. npm run build            # from the repository root
// 2. npm pack                  # from the repository root
// 3. cd examples/consumer
// 4. npm install ../../org-toolkit-0.1.0.tgz
// 5. npm run start
import { parse, toHtml } from "org-toolkit";

const source = [
  "#+TITLE: Consumer Demo",
  "",
  "* TODO Ship the package",
  "  DEADLINE: <2026-05-10 Sun>",
  "",
  "- [ ] Install the tarball",
  "- [x] Import the public API",
].join("\n");

const ast = parse(source);
console.log(toHtml(ast));
