import { readFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import type { Heading, TimestampNode } from "./ast.js";
import { resolveOrgFiles } from "./file-discovery.js";
import { findTodos } from "./query.js";
import { parse } from "./parser.js";
import { getTextContent } from "./text.js";
import { formatDateParts } from "./internal/utils.js";

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
  const files = await resolveOrgFiles(sources, cwd);
  const items = await collectAgendaItems(files, cwd, now);
  return formatAgenda(items, now);
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
  const title = getTextContent(heading).trim();
  const todo = heading.todoKeyword;
  if (todo === undefined || todo.length === 0) {
    return title;
  }

  return title.length > 0 ? `${todo} ${title}` : todo;
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
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function formatDisplayPath(filePath: string, cwd: string): string {
  const relativePath = relative(cwd, filePath);
  return relativePath.length > 0 ? relativePath : basename(filePath);
}
