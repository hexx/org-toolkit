import type {
  ASTNode,
  Block,
  CommentNode,
  DocumentMetadata,
  FootnoteDefinitionNode,
  FootnoteReferenceNode,
  Heading,
  InlineNode,
  List,
  ListItem,
  LinkNode,
  Paragraph,
  Root,
  Table,
  TableCell,
  TableRow,
  TextNode,
  TimestampNode,
} from "../ast.js";
import { assertNever, formatDateParts, stripBlockBoundaryNewlines } from "../internal/utils.js";
import { joinTopLevelChildren } from "../internal/render.js";

/**
 * Convert an AST node into semantic HTML.
 *
 * @example
 * ```ts
 * const html = toHtml(parse("* TODO Heading"));
 * ```
 */
export function toHtml(node: ASTNode): string {
  return render(node).trimEnd();
}

function render(node: ASTNode): string {
  switch (node.type) {
    case "root":
      return renderRoot(node);
    case "document-metadata":
      return renderDocumentMetadata(node);
    case "heading":
      return renderHeading(node);
    case "paragraph":
      return renderParagraph(node);
    case "list":
      return renderList(node);
    case "list-item":
      return renderListItem(node);
    case "block":
      return renderBlock(node);
    case "comment":
      return renderComment(node);
    case "horizontal-rule":
      return "<hr>";
    case "table":
      return renderTable(node);
    case "table-row":
      return renderTableRow(node, "td");
    case "table-cell":
      return renderTableCell(node);
    case "text":
      return renderText(node);
    case "hard-break":
      return "<br>";
    case "bold":
    case "italic":
    case "underline":
    case "strike-through":
    case "code":
    case "verbatim":
      return renderInlineNode(node);
    case "link":
      return renderLink(node);
    case "footnote-reference":
      return renderFootnoteReference(node);
    case "footnote-definition":
      return renderFootnoteDefinition(node);
    case "timestamp":
      return renderTimestamp(node);
    default:
      return assertNever(node);
  }
}

function renderRoot(node: Root): string {
  const metadata = Object.entries(node.metadata).map(([key, value]) =>
    renderDocumentMetadata({ type: "document-metadata", key, value, position: node.position }),
  );
  const children = joinTopLevelChildren(node.children, (child) => render(child));

  if (metadata.length === 0) {
    return children;
  }

  if (children.length === 0) {
    return metadata.join("\n");
  }

  return `${metadata.join("\n")}\n\n${children}`;
}

function renderDocumentMetadata(node: DocumentMetadata): string {
  return `<meta name="${escapeHtmlAttr(node.key.toLowerCase())}" content="${escapeHtmlAttr(node.value)}">`;
}

function renderComment(node: CommentNode): string {
  void node;
  return "";
}

function renderHeading(node: Heading): string {
  const level = Math.min(Math.max(node.level, 1), 6);
  const parts: string[] = [];
  if (node.todoKeyword !== undefined) {
    parts.push(escapeHtml(node.todoKeyword));
  }
  const content = renderInline(node.children);
  if (content.length > 0) {
    parts.push(content);
  }

  return `<h${level}>${parts.join(" ")}</h${level}>`;
}

function renderParagraph(node: Paragraph): string {
  return `<p>${renderInline(node.children)}</p>`;
}

function renderList(node: List): string {
  const tag = node.kind === "ordered" ? "ol" : "ul";
  return `<${tag}>${node.children.map((item) => renderListItem(item)).join("")}</${tag}>`;
}

function renderListItem(node: ListItem): string {
  const parts: string[] = [];

  if (node.checkbox !== null) {
    parts.push(
      `<input type="checkbox" disabled${node.checkbox === "checked" ? " checked" : ""}>`,
    );
  }

  const content = renderInline(node.children);
  if (content.length > 0) {
    parts.push(content);
  }

  if (node.subList !== undefined) {
    parts.push(renderList(node.subList));
  }

  return `<li>${parts.join(parts.length > 1 ? " " : "")}</li>`;
}

function renderBlock(node: Block): string {
  if (node.blockName === "SRC") {
    const language = node.parameters.trim();
    const className = language.length > 0 ? ` class="language-${escapeHtmlAttr(language)}"` : "";
    return `<pre><code${className}>${escapeHtml(stripBlockBoundaryNewlines(node.content))}</code></pre>`;
  }

  if (node.blockName === "QUOTE") {
    return `<blockquote>${renderBlockQuoteContent(node.content)}</blockquote>`;
  }

  const attributes = ` data-org-block="${escapeHtmlAttr(node.blockName)}"${
    node.parameters.length > 0 ? ` data-org-parameters="${escapeHtmlAttr(node.parameters)}"` : ""
  }`;
  return `<section${attributes}>${escapeHtml(stripBlockBoundaryNewlines(node.content))}</section>`;
}

function renderTable(node: Table): string {
  const separatorIndex = node.children.findIndex((row) => row.rowType === "separator");
  const headerRows = separatorIndex > 0 ? node.children.slice(0, separatorIndex) : [];
  const bodyRows =
    separatorIndex === -1 ? node.children : node.children.slice(separatorIndex + 1);

  const sections: string[] = [];
  if (headerRows.length > 0) {
    sections.push(`<thead>${headerRows.map((row) => renderTableRow(row, "th")).join("")}</thead>`);
  }

  const dataRows = bodyRows.filter((row) => row.rowType !== "separator");
  if (dataRows.length > 0) {
    sections.push(`<tbody>${dataRows.map((row) => renderTableRow(row, "td")).join("")}</tbody>`);
  }

  return `<table>${sections.join("")}</table>`;
}

function renderTableRow(node: TableRow, cellTag: "th" | "td"): string {
  if (node.rowType === "separator") {
    return "";
  }

  return `<tr>${node.children.map((cell) => renderTableCell(cell, cellTag)).join("")}</tr>`;
}

function renderTableCell(node: TableCell, cellTag: "th" | "td" = "td"): string {
  return cellTag === "th"
    ? `<th scope="col">${renderInline(node.children)}</th>`
    : `<td>${renderInline(node.children)}</td>`;
}

function renderText(node: TextNode): string {
  return escapeHtml(node.value);
}

function renderTimestamp(node: TimestampNode): string {
  const text = formatTimestampText(node);
  const datetime = formatTimestampDatetime(node);
  return `<time datetime="${escapeHtmlAttr(datetime)}">${escapeHtml(text)}</time>`;
}

function renderFootnoteReference(node: FootnoteReferenceNode): string {
  const label = escapeHtml(node.label);
  return `<sup><a href="#fn-${escapeHtmlAttr(node.label)}" id="fnref-${escapeHtmlAttr(node.label)}">${label}</a></sup>`;
}

function renderFootnoteDefinition(node: FootnoteDefinitionNode): string {
  return `<section class="footnote-definition" id="fn-${escapeHtmlAttr(node.label)}">${renderInline(node.children)}</section>`;
}

function renderInline(nodes: ReadonlyArray<InlineNode>): string {
  return nodes.map((node) => render(node)).join("");
}

function renderInlineNode(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return renderText(node);
    case "bold":
      return `<strong>${renderInline(node.children)}</strong>`;
    case "italic":
      return `<em>${renderInline(node.children)}</em>`;
    case "underline":
      return `<u>${renderInline(node.children)}</u>`;
    case "strike-through":
      return `<del>${renderInline(node.children)}</del>`;
    case "code":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "verbatim":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "link":
      return renderLink(node);
    case "footnote-reference":
      return renderFootnoteReference(node);
    case "timestamp":
      return renderTimestamp(node);
    case "hard-break":
      return "<br>";
    default:
      return assertNever(node);
  }
}

function renderLink(node: LinkNode): string {
  const content = node.description === undefined ? escapeHtml(node.url) : renderInline(node.description);
  if (!isSafeUrl(node.url)) {
    return content;
  }

  return `<a href="${escapeHtmlAttr(node.url)}">${content}</a>`;
}

function renderBlockQuoteContent(content: string): string {
  const text = stripBlockBoundaryNewlines(content);
  if (text.length === 0) {
    return "";
  }

  return text
    .split(/\r?\n/)
    .map((line) => (line.length > 0 ? escapeHtml(line) : "<br>"))
    .join("\n");
}

function formatTimestampText(node: TimestampNode): string {
  const date = formatDateParts(node.year, node.month, node.day);
  return node.time === undefined ? date : `${date} ${node.time}`;
}

function formatTimestampDatetime(node: TimestampNode): string {
  const date = formatDateParts(node.year, node.month, node.day);
  return node.time === undefined ? date : `${date}T${node.time}:00`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value);
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, "https://example.invalid");
    return ["http:", "https:", "mailto:", "ftp:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
