import { isInRange, parseVersion, type VersionRange } from "drawio-mcp-compat";

export type ServerCompatMatrix = {
  readonly supportedFloor: string;
  readonly supportedRanges: readonly VersionRange[];
};

export const SERVER_COMPAT_MATRIX: ServerCompatMatrix = {
  supportedFloor: "29.0.0",
  supportedRanges: [
    { min: "29.0.0", maxExclusive: "30.0.0" },
    { min: "30.0.0", maxExclusive: null },
  ],
};

export function versionInWindow(
  version: string,
  matrix: ServerCompatMatrix,
): boolean {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  return matrix.supportedRanges.some((r) => isInRange(parsed, r));
}
