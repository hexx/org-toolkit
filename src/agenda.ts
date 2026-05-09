import { readFile, stat } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import type { Heading, InlineNode, TimestampNode } from "./ast.js";
import { findTodos } from "./query.js";
import { parse } from "./parser.js";

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

type AgendaBucket = "overdue" | "today" | "upcoming" | "no-date";

interface AgendaItem {
  readonly heading: Heading;
  readonly filePath: string;
  readonly displayPath: string;
  readonly fileIndex: number;
  readonly todoIndex: number;
  readonly priorityRank: number;
  readonly bucket: AgendaBucket;
  readonly effectiveDate: Date | undefined;
}

interface AgendaOptions {
  readonly cwd?: string;
  readonly now?: Date;
}

const LABEL_WIDTH = 10;
const DATE_WIDTH = 10;
const GLOB_PATTERN = /[*?[\]{}()!]/;

/**
 * Build a printable agenda view from one or more org source paths.
 *
 * @example
 * ```ts
 * const output = await runAgenda(["notes"], { cwd: process.cwd() });
 * ```
 */
export async function runAgenda(
  sources: ReadonlyArray<string>,
  options: AgendaOptions = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const files = await resolveAgendaFiles(sources, cwd);
  const items = await collectAgendaItems(files, cwd, now);
  return formatAgenda(items, now);
}

async function resolveAgendaFiles(
  sources: ReadonlyArray<string>,
  cwd: string,
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
        throw new Error(`Agenda sources must be .org files, directories, or glob patterns: ${source}`);
      }

      appendUniqueFiles(files, seen, [resolved]);
      continue;
    }
  }

  if (files.length === 0) {
    throw new Error("No org files found for agenda");
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

async function collectAgendaItems(
  filePaths: ReadonlyArray<string>,
  cwd: string,
  now: Date,
): Promise<ReadonlyArray<AgendaItem>> {
  const fileRecords = await Promise.all(
    filePaths.map(async (filePath, fileIndex) => {
      const source = await readFile(filePath, "utf8");
      const ast = parse(source);
      const todos = findTodos(ast);

      return todos.map((heading, todoIndex) => createAgendaItem(heading, filePath, cwd, fileIndex, todoIndex, now));
    }),
  );

  return fileRecords.flat();
}

function createAgendaItem(
  heading: Heading,
  filePath: string,
  cwd: string,
  fileIndex: number,
  todoIndex: number,
  now: Date,
): AgendaItem {
  const deadline = heading.planning?.deadline;
  const scheduled = heading.planning?.scheduled;
  const effectiveTimestamp = deadline ?? scheduled;
  const effectiveDate = effectiveTimestamp === undefined ? undefined : timestampToDate(effectiveTimestamp);
  const bucket = classifyAgendaBucket(effectiveDate, now);

  return {
    heading,
    filePath,
    displayPath: formatDisplayPath(filePath, cwd),
    fileIndex,
    todoIndex,
    priorityRank: getPriorityRank(heading),
    bucket,
    effectiveDate,
  };
}

function classifyAgendaBucket(date: Date | undefined, now: Date): AgendaBucket {
  if (date === undefined) {
    return "no-date";
  }

  const today = startOfUtcDay(now).getTime();
  const value = startOfUtcDay(date).getTime();

  if (value < today) {
    return "overdue";
  }

  if (value === today) {
    return "today";
  }

  return "upcoming";
}

function formatAgenda(items: ReadonlyArray<AgendaItem>, now: Date): string {
  const sorted = [...items].sort((left, right) => compareAgendaItems(left, right));
  const lines = sorted.map((item) => formatAgendaItem(item, now));
  return lines.join("\n");
}

function compareAgendaItems(left: AgendaItem, right: AgendaItem): number {
  const bucketOrder: Record<AgendaBucket, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    "no-date": 3,
  };

  const bucketDiff = bucketOrder[left.bucket] - bucketOrder[right.bucket];
  if (bucketDiff !== 0) {
    return bucketDiff;
  }

  const leftDate = left.effectiveDate?.getTime();
  const rightDate = right.effectiveDate?.getTime();
  if (leftDate !== undefined && rightDate !== undefined && leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  const priorityDiff = left.priorityRank - right.priorityRank;
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const fileDiff = left.fileIndex - right.fileIndex;
  if (fileDiff !== 0) {
    return fileDiff;
  }

  return left.todoIndex - right.todoIndex;
}

function formatAgendaItem(item: AgendaItem, now: Date): string {
  const label = formatAgendaLabel(item, now).padEnd(LABEL_WIDTH);
  const date = item.effectiveDate === undefined ? "".padEnd(DATE_WIDTH) : formatDate(item.effectiveDate).padEnd(DATE_WIDTH);
  const title = formatTodoTitle(item.heading);
  return `${label} ${date} | ${title} (${item.displayPath})`;
}

function formatAgendaLabel(item: AgendaItem, now: Date): string {
  if (item.effectiveDate === undefined) {
    return "[NO DATE]";
  }

  const today = startOfUtcDay(now).getTime();
  const value = startOfUtcDay(item.effectiveDate).getTime();
  if (value < today) {
    return "[OVERDUE]";
  }

  if (value === today) {
    return "[TODAY]";
  }

  return "[UPCOMING]";
}

function formatTodoTitle(heading: Heading): string {
  const parts = [heading.todoKeyword ?? "TODO", renderInlineText(heading.children).trim()];
  return parts.filter((part) => part.length > 0).join(" ").trim();
}

function renderInlineText(nodes: ReadonlyArray<InlineNode>): string {
  return nodes.map(renderInlineNodeText).join("");
}

function renderInlineNodeText(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
      return renderInlineText(node.children);
    case "code":
    case "verbatim":
      return node.value;
    case "link":
      return node.description === undefined ? node.url : renderInlineText(node.description);
    case "footnote-reference":
      return `[fn:${node.label}]`;
    case "timestamp":
      return formatDate(timestampToDate(node));
    default:
      return assertNever(node);
  }
}

function getPriorityRank(heading: Heading): number {
  const priority = heading.properties.PRIORITY?.trim().toUpperCase();
  if (priority === "A") {
    return 0;
  }

  if (priority === "B") {
    return 1;
  }

  if (priority === "C") {
    return 2;
  }

  return 3;
}

function timestampToDate(timestamp: TimestampNode): Date {
  return new Date(Date.UTC(timestamp.year, timestamp.month - 1, timestamp.day));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function formatDisplayPath(filePath: string, cwd: string): string {
  const relativePath = relative(cwd, filePath);
  return relativePath.length > 0 ? relativePath : basename(filePath);
}

function isGlobPattern(source: string): boolean {
  return GLOB_PATTERN.test(source);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${(value as { type?: string }).type ?? "unknown"}`);
}
