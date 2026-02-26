import { describe, it, expect } from "@jest/globals";
import { strip_internal_fields } from "./events.js";

describe("strip_internal_fields", () => {
  describe("when object contains internal fields (starting with __)", () => {
    it("should remove all fields that start with __", () => {
      const input = {
        __private: "secret-data",
        publicField: "visible",
        __config: { key: "value" },
        count: 42,
        __meta: { timestamp: "2023-01-01" },
      };

      const result = strip_internal_fields(input);

      expect(result).toEqual({
        publicField: "visible",
        count: 42,
      });
    });

    it("should return an empty object when all fields are internal", () => {
      const input = {
        __internal: true,
        __version: "1.0.0",
      };

      const result = strip_internal_fields(input);

      expect(result).toEqual({});
    });

    it("should not mutate the original object", () => {
      const input = {
        __temp: "value",
        name: "original",
      };
      const originalInput = { ...input };

      strip_internal_fields(input);

      expect(input).toEqual(originalInput);
    });
  });

  describe("when object contains no internal fields", () => {
    it("should return the object unchanged when no fields start with __", () => {
      const input = {
        id: "abc123",
        name: "Test Object",
        metadata: { created: "2023-01-01" },
      };

      const result = strip_internal_fields(input);

      expect(result).toStrictEqual(input); // Should return same reference
      expect(result).toEqual(input); // With same content
    });

    it("should return an empty object when input is empty", () => {
      const input = {};

      const result = strip_internal_fields(input);

      expect(result).toEqual({});
    });
  });

  describe("TypeScript type behavior", () => {
    it("should properly exclude __ prefixed fields from the return type", () => {
      const input = {
        id: "123",
        __internal: true,
        name: "Test",
        __version: 1,
      };

      const result = strip_internal_fields(input);

      // This test is mostly for TypeScript type checking
      expect(result).toEqual({
        id: "123",
        name: "Test",
      });

      // @ts-expect-error - __internal should not exist in type
      expect(result.__internal).toBeUndefined();
      // @ts-expect-error - __version should not exist in type
      expect(result.__version).toBeUndefined();
    });
  });
});
