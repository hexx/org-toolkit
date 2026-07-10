import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "org-toolkit": entry,
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
