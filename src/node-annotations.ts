import type { Heading, TimestampNode } from "./ast.js";

const TIMESTAMP_TEXT_KEY = "__orgTimestampText";
const HEADING_PLANNING_LINES_KEY = "__orgPlanningLines";
const BLANK_LINES_AFTER_KEY = "__orgBlankLinesAfter";

type HiddenObject = Record<string, unknown>;

export function rememberTimestampText(node: TimestampNode, rawText: string): void {
  defineHiddenValue(node, TIMESTAMP_TEXT_KEY, rawText);
}

export function readTimestampText(node: TimestampNode): string | undefined {
  return readHiddenString(node, TIMESTAMP_TEXT_KEY);
}

export function rememberHeadingPlanningLines(
  node: Heading,
  rawLines: ReadonlyArray<string>,
): void {
  defineHiddenValue(node, HEADING_PLANNING_LINES_KEY, [...rawLines]);
}

export function readHeadingPlanningLines(node: Heading): ReadonlyArray<string> | undefined {
  const value = (node as unknown as HiddenObject)[HEADING_PLANNING_LINES_KEY];
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : undefined;
}

export function rememberBlankLinesAfter(node: object, blankLines: number): void {
  defineHiddenValue(node, BLANK_LINES_AFTER_KEY, blankLines);
}

export function readBlankLinesAfter(node: object): number | undefined {
  const value = (node as HiddenObject)[BLANK_LINES_AFTER_KEY];
  return typeof value === "number" ? value : undefined;
}

function defineHiddenValue(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: false,
  });
}

function readHiddenString(target: object, key: string): string | undefined {
  const value = (target as HiddenObject)[key];
  return typeof value === "string" ? value : undefined;
}
