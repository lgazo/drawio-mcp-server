import { describe, expect, it } from "@jest/globals";
import { compareVersion, parseVersion } from "drawio-mcp-compat";
import { COMPAT_MATRIX } from "./matrix.js";

describe("COMPAT_MATRIX invariants", () => {
  it("supportedFloor is a parseable version", () => {
    expect(parseVersion(COMPAT_MATRIX.supportedFloor)).not.toBeNull();
  });

  it("supportedFloor equals the smallest range min across all versioned tools", () => {
    const parsedFloor = parseVersion(COMPAT_MATRIX.supportedFloor);
    if (!parsedFloor) throw new Error("supportedFloor unparseable");
    for (const entries of Object.values(COMPAT_MATRIX.versionedTools)) {
      for (const entry of entries) {
        const min = parseVersion(entry.range.min);
        if (!min) throw new Error(`unparseable min: ${entry.range.min}`);
        expect(compareVersion(min, parsedFloor)).not.toBe(-1);
      }
    }
  });

  it("per-tool ranges are contiguous and non-overlapping", () => {
    for (const [tool, entries] of Object.entries(
      COMPAT_MATRIX.versionedTools,
    )) {
      const sorted = [...entries].sort((a, b) => {
        const am = parseVersion(a.range.min);
        const bm = parseVersion(b.range.min);
        if (!am || !bm) throw new Error(`unparseable min in ${tool}`);
        return compareVersion(am, bm);
      });
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].range.maxExclusive).toBe(sorted[i + 1].range.min);
      }
      expect(sorted.at(-1)!.range.maxExclusive).toBeNull();
    }
  });
});
