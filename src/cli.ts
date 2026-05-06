/**
 * Run the CLI with:
 *
 * ```bash
 * npx tsx src/cli.ts path/to/file.org
 * npx ts-node src/cli.ts path/to/file.org
 * npx tsx src/cli.ts --roundtrip path/to/file.org
 * ```
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "./parser.js";
import { OrgParseError } from "./errors.js";
import { stringify } from "./stringifier.js";

const USAGE = "Usage: tsx src/cli.ts [--roundtrip] <path/to/file.org>";

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
  if (filePath === undefined) {
    console.log(USAGE);
    return 1;
  }

  try {
    const source = await readFile(filePath, "utf8");
    const ast = Parser.parse(source);
    console.log(options.roundtrip ? stringify(ast) : JSON.stringify(ast, null, 2));
    return 0;
  } catch (error: unknown) {
    reportError(error);
    return 1;
  }
}

interface CliOptions {
  readonly filePath: string | undefined;
  readonly roundtrip: boolean;
  readonly showUsage: boolean;
}

function parseCliArgs(argv: ReadonlyArray<string>): CliOptions {
  let roundtrip = false;
  let filePath: string | undefined;
  let showUsage = false;

  for (const arg of argv) {
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

    if (filePath === undefined) {
      filePath = arg;
    }
  }

  if (filePath === undefined) {
    showUsage = true;
  }

  return {
    filePath,
    roundtrip,
    showUsage,
  };
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

  return resolve(entryPoint) === fileURLToPath(import.meta.url);
}

if (isDirectInvocation()) {
  void main().then((exitCode) => {
    process.exit(exitCode);
  });
}
