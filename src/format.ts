import { readFile, writeFile } from "node:fs/promises";
import type { ASTNode } from "./ast.js";
import { parse } from "./parser.js";
import { resolveOrgFiles } from "./file-discovery.js";
import { stringify } from "./stringifier.js";

interface FormatFilesOptions {
  readonly cwd?: string;
  readonly write?: boolean;
}

const TAG_COLUMN = 77;

/**
 * Format org text by parsing, normalizing annotations, and re-stringifying it.
 *
 * @example
 * ```ts
 * const formatted = format("* TODO Task :work:");
 * ```
 */
export function format(text: string): string {
  const ast = structuredClone(parse(text)) as ASTNode;
  const normalized = stringify(ast);
  return alignHeadingTags(normalized);
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

function alignHeadingTags(text: string): string {
  return text
    .split("\n")
    .map((line) => alignHeadingTagsInLine(line))
    .join("\n");
}

function alignHeadingTagsInLine(line: string): string {
  const match = line.match(/^(?<body>\*+.*?)(?<space>\s)(?<tags>:[A-Za-z0-9_@#%]+(?::[A-Za-z0-9_@#%]+)*:)$/);
  if (match === null || match.groups === undefined) {
    return line;
  }

  const body = match.groups.body ?? "";
  const tags = match.groups.tags ?? "";
  const padding = Math.max(1, TAG_COLUMN - body.length);
  return `${body}${" ".repeat(padding)}${tags}`;
}
