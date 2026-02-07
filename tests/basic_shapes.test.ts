import { BASIC_SHAPES, BASIC_SHAPE_CATEGORIES, getBasicShape } from "../src/shapes/basic_shapes.js";

describe("basic_shapes", () => {
  describe("BASIC_SHAPES", () => {
    it("should define all 13 basic shapes", () => {
      const expected = ["rectangle", "rounded", "ellipse", "diamond", "circle", "process", "decision", "start", "end", "parallelogram", "hexagon", "cylinder", "triangle"];
      expect(Object.keys(BASIC_SHAPES).sort()).toEqual(expected.sort());
    });

    it("should include a style string for every shape", () => {
      for (const shape of Object.values(BASIC_SHAPES)) {
        expect(shape.style).toBeTruthy();
        expect(shape.style.endsWith(";")).toBe(true);
      }
    });

    it("should include positive default dimensions for every shape", () => {
      for (const shape of Object.values(BASIC_SHAPES)) {
        expect(shape.defaultWidth).toBeGreaterThan(0);
        expect(shape.defaultHeight).toBeGreaterThan(0);
      }
    });
  });

  describe("BASIC_SHAPE_CATEGORIES", () => {
    it("should define general and flowchart categories", () => {
      expect(BASIC_SHAPE_CATEGORIES).toHaveProperty("general");
      expect(BASIC_SHAPE_CATEGORIES).toHaveProperty("flowchart");
    });

    it("should reference only shapes that exist in BASIC_SHAPES", () => {
      for (const names of Object.values(BASIC_SHAPE_CATEGORIES)) {
        for (const name of names) {
          expect(BASIC_SHAPES).toHaveProperty(name);
        }
      }
    });
  });

  describe("getBasicShape", () => {
    it("should return a shape for a known name", () => {
      const shape = getBasicShape("rectangle");
      expect(shape).toBeDefined();
      expect(shape!.name).toBe("rectangle");
    });

    it("should be case-insensitive", () => {
      expect(getBasicShape("RECTANGLE")).toEqual(getBasicShape("rectangle"));
      expect(getBasicShape("Start")).toEqual(getBasicShape("start"));
    });

    it("should return undefined for unknown shapes", () => {
      expect(getBasicShape("nonexistent")).toBeUndefined();
      expect(getBasicShape("azure-vm")).toBeUndefined();
    });

    it("should not match partial names", () => {
      expect(getBasicShape("rect")).toBeUndefined();
      expect(getBasicShape("star")).toBeUndefined();
    });
  });
});
