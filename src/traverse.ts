import type {
  ASTNode,
  Heading,
  TimestampNode,
} from "./ast.js";
import { assertNever } from "./internal/utils.js";

export interface WalkContext {
  readonly parent?: ASTNode;
  readonly depth: number;
}

export type VisitorCallback = (node: ASTNode, context: WalkContext) => void;

export type VisitorMap = {
  readonly [K in ASTNode["type"]]?: (
    node: Extract<ASTNode, { type: K }>,
    context: WalkContext,
  ) => void;
} & {
  readonly visit?: VisitorCallback;
};

export type Visitor = VisitorCallback | VisitorMap;

/**
 * Walk an AST depth-first in pre-order.
 *
 * @example
 * ```ts
 * walk(parse("* TODO Heading"), {
 *   heading(node) {
 *     console.log(node.level);
 *   },
 * });
 * ```
 */
export function walk(node: ASTNode, visitor: Visitor): void {
  visitNode(node, visitor, { depth: 0 });
}

function visitNode(node: ASTNode, visitor: Visitor, context: WalkContext): void {
  invokeVisitor(visitor, node, context);

  switch (node.type) {
    case "root":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "heading":
      visitHeadingPlanning(node, visitor, context.depth + 1);
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "paragraph":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "list":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "list-item":
      visitArray(node.children, visitor, node, context.depth + 1);
      if (node.subList !== undefined) {
        visitNode(node.subList, visitor, { parent: node, depth: context.depth + 1 });
      }
      break;
    case "block":
    case "document-metadata":
    case "comment":
    case "horizontal-rule":
    case "text":
    case "timestamp":
    case "footnote-reference":
    case "code":
    case "verbatim":
    case "hard-break":
      break;
    case "footnote-definition":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "table":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "table-row":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "table-cell":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
      visitArray(node.children, visitor, node, context.depth + 1);
      break;
    case "link":
      if (node.description !== undefined) {
        visitArray(node.description, visitor, node, context.depth + 1);
      }
      break;
    default:
      assertNever(node);
  }
}

function visitHeadingPlanning(
  heading: Heading,
  visitor: Visitor,
  depth: number,
): void {
  const planning = heading.planning;
  if (planning === undefined) {
    return;
  }

  visitOptionalTimestamp(planning.scheduled, visitor, heading, depth);
  visitOptionalTimestamp(planning.deadline, visitor, heading, depth);
  visitOptionalTimestamp(planning.closed, visitor, heading, depth);
}

function visitOptionalTimestamp(
  timestamp: TimestampNode | undefined,
  visitor: Visitor,
  parent: Heading,
  depth: number,
): void {
  if (timestamp !== undefined) {
    visitNode(timestamp, visitor, { parent, depth });
  }
}

function visitArray(
  nodes: ReadonlyArray<ASTNode>,
  visitor: Visitor,
  parent: ASTNode,
  depth: number,
): void {
  for (const child of nodes) {
    visitNode(child, visitor, { parent, depth });
  }
}

function invokeVisitor(visitor: Visitor, node: ASTNode, context: WalkContext): void {
  if (typeof visitor === "function") {
    visitor(node, context);
    return;
  }

  visitor.visit?.(node, context);

  switch (node.type) {
    case "root":
      visitor.root?.(node, context);
      break;
    case "heading":
      visitor.heading?.(node, context);
      break;
    case "paragraph":
      visitor.paragraph?.(node, context);
      break;
    case "list":
      visitor.list?.(node, context);
      break;
    case "list-item":
      visitor["list-item"]?.(node, context);
      break;
    case "block":
      visitor.block?.(node, context);
      break;
    case "table":
      visitor.table?.(node, context);
      break;
    case "table-row":
      visitor["table-row"]?.(node, context);
      break;
    case "table-cell":
      visitor["table-cell"]?.(node, context);
      break;
    case "text":
      visitor.text?.(node, context);
      break;
    case "comment":
      visitor.comment?.(node, context);
      break;
    case "bold":
      visitor.bold?.(node, context);
      break;
    case "italic":
      visitor.italic?.(node, context);
      break;
    case "underline":
      visitor.underline?.(node, context);
      break;
    case "code":
      visitor.code?.(node, context);
      break;
    case "verbatim":
      visitor.verbatim?.(node, context);
      break;
    case "link":
      visitor.link?.(node, context);
      break;
    case "footnote-reference":
      visitor["footnote-reference"]?.(node, context);
      break;
    case "footnote-definition":
      visitor["footnote-definition"]?.(node, context);
      break;
    case "strike-through":
      visitor["strike-through"]?.(node, context);
      break;
    case "timestamp":
      visitor.timestamp?.(node, context);
      break;
    case "document-metadata":
      visitor["document-metadata"]?.(node, context);
      break;
    case "horizontal-rule":
      visitor["horizontal-rule"]?.(node, context);
      break;
    case "hard-break":
      visitor["hard-break"]?.(node, context);
      break;
    default:
      assertNever(node);
  }
}
