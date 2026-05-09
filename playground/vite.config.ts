import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const browserEntry = fileURLToPath(new URL("../src/browser.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "org-toolkit": browserEntry,
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
