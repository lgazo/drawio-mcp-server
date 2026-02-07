import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import { BASIC_SHAPES, BASIC_SHAPE_CATEGORIES, getBasicShape } from "../src/shapes/basic_shapes.ts";

describe("basic_shapes", () => {
  describe("BASIC_SHAPES", () => {
    it("should define all 13 basic shapes", () => {
      const expected = ["rectangle", "rounded", "ellipse", "diamond", "circle", "process", "decision", "start", "end", "parallelogram", "hexagon", "cylinder", "triangle"];
      assertEquals(Object.keys(BASIC_SHAPES).sort(), expected.sort());
    });

    it("should include a style string for every shape", () => {
      for (const shape of Object.values(BASIC_SHAPES)) {
        assert(shape.style, "shape should have a style");
        assertEquals(shape.style.endsWith(";"), true);
      }
    });

    it("should include positive default dimensions for every shape", () => {
      for (const shape of Object.values(BASIC_SHAPES)) {
        assert(shape.defaultWidth > 0);
        assert(shape.defaultHeight > 0);
      }
    });
  });

  describe("BASIC_SHAPE_CATEGORIES", () => {
    it("should define general and flowchart categories", () => {
      assert("general" in BASIC_SHAPE_CATEGORIES);
      assert("flowchart" in BASIC_SHAPE_CATEGORIES);
    });

    it("should reference only shapes that exist in BASIC_SHAPES", () => {
      for (const names of Object.values(BASIC_SHAPE_CATEGORIES)) {
        for (const name of names) {
          assert(name in BASIC_SHAPES);
        }
      }
    });
  });

  describe("getBasicShape", () => {
    it("should return a shape for a known name", () => {
      const shape = getBasicShape("rectangle");
      assertExists(shape);
      assertEquals(shape!.name, "rectangle");
    });

    it("should be case-insensitive", () => {
      assertEquals(getBasicShape("RECTANGLE"), getBasicShape("rectangle"));
      assertEquals(getBasicShape("Start"), getBasicShape("start"));
    });

    it("should return undefined for unknown shapes", () => {
      assertEquals(getBasicShape("nonexistent"), undefined);
      assertEquals(getBasicShape("azure-vm"), undefined);
    });

    it("should not match partial names", () => {
      assertEquals(getBasicShape("rect"), undefined);
      assertEquals(getBasicShape("star"), undefined);
    });
  });
});
