import {
  compareVersion,
  isBelowFloor,
  isInRange,
  parseVersion,
  type DetectedVersion,
} from "drawio-mcp-compat";
import type { CompatMatrix, ToolImpl } from "./matrix.js";

export type DispatchOutcome =
  | { kind: "matched"; impl: ToolImpl }
  | { kind: "below-floor"; floor: string; detected: string }
  | { kind: "above-window"; lastRangeMin: string; detected: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

export function dispatchTool(
  toolName: string,
  detected: DetectedVersion,
  matrix: CompatMatrix,
): DispatchOutcome | null {
  const entries = matrix.versionedTools[toolName];
  if (!entries || entries.length === 0) return null;

  if (!detected.ok) {
    return { kind: "no-version", reason: detected.reason };
  }

  if (isBelowFloor(detected.semver, matrix.supportedFloor)) {
    return {
      kind: "below-floor",
      floor: matrix.supportedFloor,
      detected: detected.raw,
    };
  }

  for (const entry of entries) {
    if (isInRange(detected.semver, entry.range)) {
      return { kind: "matched", impl: entry.impl };
    }
  }

  const sorted = [...entries].sort((a, b) => {
    const am = parseVersion(a.range.min)!;
    const bm = parseVersion(b.range.min)!;
    return compareVersion(am, bm);
  });
  return {
    kind: "above-window",
    lastRangeMin: sorted.at(-1)!.range.min,
    detected: detected.raw,
  };
}
