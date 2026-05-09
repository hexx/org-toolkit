import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

interface FastGlobOptions {
  readonly cwd?: string;
  readonly absolute?: boolean;
  readonly onlyFiles?: boolean;
  readonly unique?: boolean;
  readonly dot?: boolean;
  readonly followSymbolicLinks?: boolean;
}

type FastGlobRunner = (
  patterns: string | ReadonlyArray<string>,
  options: FastGlobOptions,
) => Promise<ReadonlyArray<string>>;

const GLOB_PATTERN = /[*?[\]{}()!]/;

/**
 * Resolve org-mode sources to absolute `.org` file paths.
 *
 * @example
 * ```ts
 * const files = await resolveOrgFiles(["docs/" + "**" + "/*.org"]);
 * ```
 */
export async function resolveOrgFiles(
  sources: ReadonlyArray<string>,
  cwd: string = process.cwd(),
): Promise<ReadonlyArray<string>> {
  const files: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const resolved = resolve(cwd, source);
    if (isGlobPattern(source)) {
      const matches = await expandGlob(source, cwd);
      appendUniqueFiles(files, seen, matches);
      continue;
    }

    const sourceStat = await stat(resolved);
    if (sourceStat.isDirectory()) {
      const matches = await expandGlob("**/*.org", resolved);
      appendUniqueFiles(files, seen, matches);
      continue;
    }

    if (sourceStat.isFile()) {
      if (extname(resolved).toLowerCase() !== ".org") {
        throw new Error(`Org sources must be .org files, directories, or glob patterns: ${source}`);
      }

      appendUniqueFiles(files, seen, [resolved]);
      continue;
    }
  }

  if (files.length === 0) {
    throw new Error("No org files found");
  }

  return files;
}

async function expandGlob(pattern: string, cwd: string): Promise<ReadonlyArray<string>> {
  const glob = await loadFastGlob();
  const matches = await glob(pattern, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true,
    dot: false,
    followSymbolicLinks: false,
  });

  return matches.filter((filePath) => extname(filePath).toLowerCase() === ".org");
}

async function loadFastGlob(): Promise<FastGlobRunner> {
  const module = (await import("fast-glob")) as unknown as { readonly default: FastGlobRunner };
  return module.default;
}

function appendUniqueFiles(
  output: string[],
  seen: Set<string>,
  files: ReadonlyArray<string>,
): void {
  for (const filePath of files) {
    if (seen.has(filePath)) {
      continue;
    }

    seen.add(filePath);
    output.push(filePath);
  }
}

function isGlobPattern(source: string): boolean {
  return GLOB_PATTERN.test(source);
}
