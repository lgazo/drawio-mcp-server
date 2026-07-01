import { describe, expect, it } from "@jest/globals";
import type { CompatMatrix, ToolImpl } from "./matrix.js";
import { dispatchTool } from "./dispatch.js";

const implV29: ToolImpl = () => "v29";
const implV30: ToolImpl = () => "v30";

const matrix: CompatMatrix = {
  supportedFloor: "29.0.0",
  versionedTools: {
    "import-mermaid": [
      { range: { min: "29.0.0", maxExclusive: "30.0.0" }, impl: implV29 },
      { range: { min: "30.0.0", maxExclusive: null }, impl: implV30 },
    ],
  },
};

describe("dispatchTool", () => {
  it("returns matched impl when version is in a range", () => {
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: true, raw: "30.2.6", semver: [30, 2, 6] },
      matrix,
    );
    expect(outcome).toEqual({ kind: "matched", impl: implV30 });
  });

  it("returns below-floor when version predates all ranges", () => {
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: true, raw: "28.0.0", semver: [28, 0, 0] },
      matrix,
    );
    expect(outcome).toEqual({
      kind: "below-floor",
      floor: "29.0.0",
      detected: "28.0.0",
    });
  });

  it("returns above-window when version is past the open-ended range and no range matches", () => {
    // With maxExclusive: null on the newest range, "above-window" only occurs
    // when the newest range's max is bounded. Construct a bounded matrix.
    const bounded: CompatMatrix = {
      supportedFloor: "29.0.0",
      versionedTools: {
        "import-mermaid": [
          { range: { min: "29.0.0", maxExclusive: "30.0.0" }, impl: implV29 },
          { range: { min: "30.0.0", maxExclusive: "31.0.0" }, impl: implV30 },
        ],
      },
    };
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: true, raw: "31.5.0", semver: [31, 5, 0] },
      bounded,
    );
    expect(outcome).toEqual({
      kind: "above-window",
      lastRangeMin: "30.0.0",
      detected: "31.5.0",
    });
  });

  it("returns no-version when detection failed", () => {
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: false, reason: "missing", raw: null },
      matrix,
    );
    expect(outcome).toEqual({ kind: "no-version", reason: "missing" });
  });

  it("returns null when the tool has no matrix entries", () => {
    const outcome = dispatchTool(
      "add-edge",
      { ok: true, raw: "30.2.6", semver: [30, 2, 6] },
      matrix,
    );
    expect(outcome).toBeNull();
  });
});
