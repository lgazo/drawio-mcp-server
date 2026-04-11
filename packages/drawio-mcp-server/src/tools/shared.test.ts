import { describe, expect, it } from "@jest/globals";

import { target_page_field } from "./shared.js";

describe("target_page schema", () => {
  const schema = target_page_field();

  it("accepts an index selector", () => {
    expect(schema.safeParse({ index: 0 }).success).toBe(true);
  });

  it("accepts an id selector", () => {
    expect(schema.safeParse({ id: "page-123" }).success).toBe(true);
  });

  it("rejects missing selector fields", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects providing both index and id", () => {
    const result = schema.safeParse({ index: 1, id: "page-123" });
    expect(result.success).toBe(false);
  });
});
