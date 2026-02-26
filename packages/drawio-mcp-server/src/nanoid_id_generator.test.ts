import { describe, expect, it } from "@jest/globals";
import { nanoid_id_generator } from "./nanoid_id_generator.js";

describe("nanoid_id_generator", () => {
  it("should return an object with a generate function", () => {
    const generator = nanoid_id_generator();
    expect(generator).toHaveProperty("generate");
    expect(typeof generator.generate).toBe("function");
  });

  it("should generate a string ID", () => {
    const generator = nanoid_id_generator();
    const id = generator.generate();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("should generate different IDs on subsequent calls", () => {
    const generator = nanoid_id_generator();
    const id1 = generator.generate();
    const id2 = generator.generate();
    expect(id1).not.toBe(id2);
  });

  it("should generate IDs of default length (21 characters)", () => {
    const generator = nanoid_id_generator();
    const id = generator.generate();
    expect(id).toHaveLength(21);
  });
});
