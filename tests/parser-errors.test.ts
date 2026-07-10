import { describe, expect, it } from "vitest";
import { OrgParseError, parse } from "../src/index.js";

function expectParseError(input: string, messageFragment: string): void {
  let caught: unknown;
  try {
    parse(input);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(OrgParseError);
  const error = caught as OrgParseError;
  expect(error.message).toContain(messageFragment);
  // The parser attaches source position so callers can surface line/column.
  expect(error.position).toBeDefined();
}

describe("parse error handling", () => {
  it("throws OrgParseError on an invalid planning timestamp", () => {
    expectParseError(
      ["* Heading", "SCHEDULED: <not-a-date>"].join("\n"),
      "Invalid planning timestamp",
    );
  });

  it("throws OrgParseError on a malformed property drawer line", () => {
    expectParseError(
      ["* Heading", ":PROPERTIES:", "this is not a property", ":END:"].join("\n"),
      "Invalid property drawer line",
    );
  });

  it("throws OrgParseError on an unterminated property drawer", () => {
    expectParseError(
      ["* Heading", ":PROPERTIES:", ":AUTHOR: Alice"].join("\n"),
      "Unterminated property drawer",
    );
  });

  it("throws OrgParseError on an unterminated block", () => {
    expectParseError(
      ["#+BEGIN_SRC typescript", "console.log('hi');"].join("\n"),
      "Unterminated block: SRC",
    );
  });
});
