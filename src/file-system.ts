/**
 * Node-only file-system helpers.
 *
 * This entry is intentionally kept out of the main `org-toolkit` entry so that
 * `parse`, `format`, `stringify`, exporters, and friends can be bundled for
 * browsers and edge runtimes (e.g. Cloudflare Workers) without pulling in
 * `node:fs` or `node:path`.
 *
 * Import from `"org-toolkit/file-system"` when you need file/directory/glob
 * resolution or in-place formatting in a Node environment.
 */
import { readFile, writeFile } from "node:fs/promises";
import { format } from "./format.js";
import { resolveOrgFiles } from "./file-discovery.js";

export { resolveOrgFiles };

export interface FormatFilesOptions {
  readonly cwd?: string;
  readonly write?: boolean;
}

/**
 * Format one or more org sources resolved from files, directories, or globs.
 *
 * When `write` is true, files are rewritten in place and an empty string is
 * returned.
 */
export async function formatFiles(
  sources: ReadonlyArray<string>,
  options: FormatFilesOptions = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const files = await resolveOrgFiles(sources, cwd);
  const write = options.write ?? false;

  const outputs: string[] = [];
  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const formatted = format(source);
    if (write) {
      await writeFile(filePath, formatted, "utf8");
    } else {
      outputs.push(formatted);
    }
  }

  return write ? "" : outputs.join("\n\n");
}
