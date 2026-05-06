import type { ASTNode, Heading, Root } from "./ast.js";
import { walk } from "./traverse.js";

/**
 * Find every node of a specific type in the tree.
 *
 * @example
 * ```ts
 * const headings = findAllByType(parse("* TODO Heading"), "heading");
 * ```
 */
export function findAllByType<T extends ASTNode["type"]>(
  ast: Root,
  type: T,
): ReadonlyArray<Extract<ASTNode, { type: T }>> {
  const nodes: Array<Extract<ASTNode, { type: T }>> = [];

  walk(ast, (node) => {
    if (node.type === type) {
      nodes.push(node as Extract<ASTNode, { type: T }>);
    }
  });

  return nodes;
}

/**
 * Find headings marked with the TODO keyword.
 *
 * @example
 * ```ts
 * const todos = findTodos(parse("* TODO Task"));
 * ```
 */
export function findTodos(ast: Root): ReadonlyArray<Heading> {
  const headings: Heading[] = [];

  walk(ast, (node) => {
    if (node.type === "heading" && node.todoKeyword === "TODO") {
      headings.push(node);
    }
  });

  return headings;
}

/**
 * Find headings that contain a given tag.
 *
 * @example
 * ```ts
 * const work = findHeadingsByTag(parse("* Heading :work:"), "work");
 * ```
 */
export function findHeadingsByTag(ast: Root, tag: string): ReadonlyArray<Heading> {
  const headings: Heading[] = [];

  walk(ast, (node) => {
    if (node.type === "heading" && node.tags.includes(tag)) {
      headings.push(node);
    }
  });

  return headings;
}
