/**
 * Run the CLI with:
 *
 * ```bash
 * npx tsx src/cli.ts path/to/file.org
 * npx ts-node src/cli.ts path/to/file.org
 * ```
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "./parser.js";
import { OrgParseError } from "./errors.js";

const USAGE = "Usage: tsx src/cli.ts <path/to/file.org>";

/**
 * Execute the CLI and return an exit code.
 *
 * @example
 * ```ts
 * const exitCode = await main(["sample.org"]);
 * ```
 */
export async function main(argv: ReadonlyArray<string> = process.argv.slice(2)): Promise<number> {
  const filePath = argv[0];
  if (filePath === undefined || filePath === "--help" || filePath === "-h") {
    console.log(USAGE);
    return filePath === undefined ? 1 : 0;
  }

  try {
    const source = await readFile(filePath, "utf8");
    const ast = Parser.parse(source);
    console.log(JSON.stringify(ast, null, 2));
    return 0;
  } catch (error: unknown) {
    reportError(error);
    return 1;
  }
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
