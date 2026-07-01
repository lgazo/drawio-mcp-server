import { describe, expect, it } from "@jest/globals";
import {
  compareVersion,
  isBelowFloor,
  isInRange,
  parseVersion,
} from "./index.js";

describe("parseVersion", () => {
  it("parses `X.Y.Z`", () => {
    expect(parseVersion("30.2.6")).toEqual([30, 2, 6]);
  });
  it("parses with pre-release/build suffix", () => {
    expect(parseVersion("30.2.6-beta.1")).toEqual([30, 2, 6]);
    expect(parseVersion("30.2.6+build.42")).toEqual([30, 2, 6]);
  });
  it("returns null on garbage", () => {
    expect(parseVersion("nope")).toBeNull();
    expect(parseVersion("30.2")).toBeNull();
  });
});

describe("compareVersion", () => {
  it("compares major then minor then patch", () => {
    expect(compareVersion([1, 0, 0], [2, 0, 0])).toBe(-1);
    expect(compareVersion([2, 0, 0], [2, 0, 0])).toBe(0);
    expect(compareVersion([2, 1, 0], [2, 0, 9])).toBe(1);
    expect(compareVersion([2, 1, 5], [2, 1, 6])).toBe(-1);
  });
});

describe("isBelowFloor", () => {
  it("returns true when version < floor", () => {
    expect(isBelowFloor([29, 6, 7], "30.0.0")).toBe(true);
    expect(isBelowFloor([30, 0, 0], "30.0.0")).toBe(false);
    expect(isBelowFloor([30, 2, 6], "30.0.0")).toBe(false);
  });
  it("returns false when floor is unparseable", () => {
    expect(isBelowFloor([29, 6, 7], "garbage")).toBe(false);
  });
});

describe("isInRange", () => {
  it("respects inclusive min + exclusive max", () => {
    const r = { min: "30.0.0", maxExclusive: "31.0.0" };
    expect(isInRange([29, 6, 7], r)).toBe(false);
    expect(isInRange([30, 0, 0], r)).toBe(true);
    expect(isInRange([30, 2, 6], r)).toBe(true);
    expect(isInRange([31, 0, 0], r)).toBe(false);
  });
  it("treats null maxExclusive as open-ended", () => {
    const r = { min: "30.0.0", maxExclusive: null };
    expect(isInRange([30, 0, 0], r)).toBe(true);
    expect(isInRange([99, 99, 99], r)).toBe(true);
  });
});
