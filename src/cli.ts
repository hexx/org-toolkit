#!/usr/bin/env node
/**
 * Run the CLI with:
 *
 * ```bash
 * npx org-toolkit path/to/file.org
 * npx org-toolkit --format path/to/file.org
 * npx org-toolkit --format --write path/to/file.org
 * npx org-toolkit --markdown path/to/file.org
 * npx org-toolkit --html path/to/file.org
 * npx org-toolkit --roundtrip path/to/file.org
 * npx org-toolkit --agenda ./my-notes
 * ```
 */
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse } from "./parser.js";
import { OrgParseError } from "./errors.js";
import { runAgenda } from "./agenda.js";
import { formatFiles } from "./file-system.js";
import { toHtml } from "./exporters/html.js";
import { toMarkdown } from "./exporters/markdown.js";
import { stringify } from "./stringifier.js";

const USAGE = "Usage: tsx src/cli.ts [--agenda|--format|--html|--markdown|--roundtrip] <path|glob>";

interface CliOptions {
  readonly agenda: boolean;
  readonly format: boolean;
  readonly write: boolean;
  readonly sources: ReadonlyArray<string>;
  readonly html: boolean;
  readonly markdown: boolean;
  readonly roundtrip: boolean;
}

/**
 * Execute the CLI and return an exit code.
 *
 * @example
 * ```ts
 * const exitCode = await main(["sample.org"]);
 * ```
 */
export async function main(argv: ReadonlyArray<string> = process.argv.slice(2)): Promise<number> {
  const options = parseCliArgs(argv);
  if (options === null) {
    console.log(USAGE);
    return 1;
  }

  if (options.agenda) {
    const output = await runAgenda(options.sources, {
      cwd: await resolveAgendaCwd(options.sources),
    });
    if (output.length > 0) {
      console.log(output);
    }
    return 0;
  }

  if (options.format) {
    const output = await formatFiles(options.sources, {
      write: options.write,
    });
    if (output.length > 0) {
      console.log(output);
    }
    return 0;
  }

  const file = options.sources[0];
  if (file === undefined) {
    console.log(USAGE);
    return 1;
  }

  try {
    const source = await readFile(file, "utf8");
    const ast = parse(source);
    if (options.html) {
      console.log(toHtml(ast));
    } else if (options.markdown) {
      console.log(toMarkdown(ast));
    } else if (options.roundtrip) {
      console.log(stringify(ast));
    } else {
      console.log(JSON.stringify(ast, null, 2));
    }
    return 0;
  } catch (error: unknown) {
    reportError(error);
    return 1;
  }
}

function parseCliArgs(argv: ReadonlyArray<string>): CliOptions | null {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        agenda: { type: "boolean", default: false },
        format: { type: "boolean", default: false },
        write: { type: "boolean", default: false },
        html: { type: "boolean", default: false },
        markdown: { type: "boolean", default: false },
        roundtrip: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch {
    return null;
  }

  const { values, positionals } = parsed;
  const commandCount = [values.agenda, values.format, values.html, values.markdown, values.roundtrip].filter(
    Boolean,
  ).length;

  if (
    values.help ||
    commandCount > 1 ||
    (values.write && !values.format) ||
    positionals.length === 0
  ) {
    return null;
  }

  return {
    agenda: values.agenda,
    format: values.format,
    write: values.write,
    sources: positionals,
    html: values.html,
    markdown: values.markdown,
    roundtrip: values.roundtrip,
  };
}

async function resolveAgendaCwd(sources: ReadonlyArray<string>): Promise<string> {
  if (sources.length !== 1) {
    return process.cwd();
  }

  const source = sources[0];
  if (source === undefined || isLikelyGlobPattern(source)) {
    return process.cwd();
  }

  const resolved = resolve(process.cwd(), source);
  try {
    const entry = await stat(resolved);
    if (entry.isDirectory()) {
      return resolved;
    }

    if (entry.isFile()) {
      return dirname(resolved);
    }

    return process.cwd();
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return process.cwd();
    }

    throw error;
  }
}

function isLikelyGlobPattern(source: string): boolean {
  return /[*?[\]{}()!]/.test(source);
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT";
}

function reportError(error: unknown): void {
  if (error instanceof OrgParseError) {
    console.error(`Parse error: ${error.message}`);
    if (error.position !== undefined) {
      console.error(
        `  at line ${error.position.line}, column ${error.position.column} (index ${error.position.index})`,
      );
    }
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
    return;
  }

  console.error(String(error));
}

function isDirectInvocation(): boolean {
  const entryPoint = process.argv[1];
  if (entryPoint === undefined) {
    return false;
  }

  try {
    return fileURLToPath(import.meta.url) === resolve(entryPoint);
  } catch {
    return /[\\/](cli\.(?:ts|js|cjs))$/.test(entryPoint);
  }
}

if (isDirectInvocation()) {
  void main()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      reportError(error);
      process.exit(1);
    });
}
