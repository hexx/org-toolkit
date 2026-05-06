import type { Position } from "./ast.js";

/**
 * An error raised while parsing org-mode input.
 *
 * The error keeps the source position so callers can surface exact line and
 * column information to users.
 *
 * @example
 * ```ts
 * throw new OrgParseError("Invalid metadata line", {
 *   index: 0,
 *   line: 1,
 *   column: 1,
 * });
 * ```
 */
export class OrgParseError extends Error {
  /**
   * The source position associated with the parse failure.
   */
  readonly position: Position | undefined;

  public constructor(message: string, position?: Position) {
    super(message);
    this.name = "OrgParseError";
    this.position = position;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
