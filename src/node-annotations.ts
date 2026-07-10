import type { Heading } from "./ast.js";

/**
 * Parser-to-stringifier side channel for data that is "serialization
 * metadata" rather than first-class AST content.
 *
 * These values are stored in WeakMaps (instead of hidden non-enumerable
 * properties on the nodes) so the AST objects stay clean: `JSON.stringify`,
 * structural cloning, and deep-equality checks see only the fields declared
 * in `ast.ts`. WeakMap entries are intentionally not copied by AST cloning,
 * which means transformed trees fall back to sensible defaults (one blank
 * line between top-level nodes, reconstructed planning output).
 */

const planningLinesStore = new WeakMap<Heading, ReadonlyArray<string>>();
const blankLinesAfterStore = new WeakMap<object, number>();

export function rememberHeadingPlanningLines(
  node: Heading,
  rawLines: ReadonlyArray<string>,
): void {
  planningLinesStore.set(node, [...rawLines]);
}

export function readHeadingPlanningLines(node: Heading): ReadonlyArray<string> | undefined {
  return planningLinesStore.get(node);
}

export function rememberBlankLinesAfter(node: object, blankLines: number): void {
  blankLinesAfterStore.set(node, blankLines);
}

export function readBlankLinesAfter(node: object): number | undefined {
  return blankLinesAfterStore.get(node);
}
