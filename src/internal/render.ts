import { readBlankLinesAfter } from "../node-annotations.js";

/**
 * Render top-level children and join them with the blank-line spacing
 * recorded by the parser.
 *
 * Shared by the org stringifier and the markdown/HTML exporters so the
 * inter-block spacing stays consistent across every output format.
 */
export function joinTopLevelChildren<T extends { readonly type: string }>(
  children: ReadonlyArray<T>,
  renderNode: (node: T) => string,
): string {
  const rendered: string[] = [];

  children.forEach((child, index) => {
    const value = renderNode(child);
    if (value.length === 0) {
      return;
    }

    if (rendered.length > 0) {
      const previous = children[index - 1];
      const blankLinesAfter = previous === undefined ? undefined : readBlankLinesAfter(previous);
      const blankLines = blankLinesAfter ?? 1;
      rendered.push("\n".repeat(blankLines + 1));
    }

    rendered.push(value);
  });

  return rendered.join("");
}
