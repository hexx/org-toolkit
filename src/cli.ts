#!/usr/bin/env node
/**
 * Run the CLI with:
 *
 * ```bash
 * npx tsx src/cli.ts path/to/file.org
 * npx ts-node src/cli.ts path/to/file.org
 * npx tsx src/cli.ts --roundtrip path/to/file.org
 * npx tsx src/cli.ts --markdown path/to/file.org
 * ```
 */
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Parser } from "./parser.js";
import { OrgParseError } from "./errors.js";
import { runAgenda } from "./agenda.js";
import { toHtml } from "./exporters/html.js";
import { toMarkdown } from "./exporters/markdown.js";
import { stringify } from "./stringifier.js";

const USAGE = "Usage: tsx src/cli.ts [--agenda|--html|--markdown|--roundtrip] <path|glob>";

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
  if (options.showUsage) {
    console.log(USAGE);
    return options.filePath === undefined ? 1 : 0;
  }

  const filePath = options.filePath;
  if (options.agenda) {
    const output = await runAgenda(options.sources, {
      cwd: await resolveAgendaCwd(options.sources),
    });
    if (output.length > 0) {
      console.log(output);
    }
    return 0;
  }

  if (filePath === undefined) {
    console.log(USAGE);
    return 1;
  }

  try {
    const source = await readFile(filePath, "utf8");
    const ast = Parser.parse(source);
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

interface CliOptions {
  readonly agenda: boolean;
  readonly sources: ReadonlyArray<string>;
  readonly filePath: string | undefined;
  readonly html: boolean;
  readonly markdown: boolean;
  readonly roundtrip: boolean;
  readonly showUsage: boolean;
}

function parseCliArgs(argv: ReadonlyArray<string>): CliOptions {
  let agenda = false;
  let html = false;
  let markdown = false;
  let roundtrip = false;
  let filePath: string | undefined;
  const sources: string[] = [];
  let showUsage = false;

  for (const arg of argv) {
    if (arg === "--agenda") {
      agenda = true;
      continue;
    }

    if (arg === "--html") {
      html = true;
      continue;
    }

    if (arg === "--markdown") {
      markdown = true;
      continue;
    }

    if (arg === "--roundtrip") {
      roundtrip = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      showUsage = true;
      continue;
    }

    if (arg.startsWith("-")) {
      continue;
    }

    sources.push(arg);
    if (filePath === undefined) {
      filePath = arg;
    }
  }

  if ((agenda && sources.length === 0) || (!agenda && filePath === undefined)) {
    showUsage = true;
  }

  return {
    agenda,
    sources,
    filePath,
    html,
    markdown,
    roundtrip,
    showUsage,
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

  return /[\\/](cli\.(?:ts|js|cjs))$/.test(entryPoint);
}

if (isDirectInvocation()) {
  void main().then((exitCode) => {
    process.exit(exitCode);
  });
}
