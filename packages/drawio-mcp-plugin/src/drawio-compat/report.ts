import { isBelowFloor, parseVersion } from "drawio-mcp-compat";
import { COMPAT_MATRIX } from "./matrix.js";
import { getDetectedDrawioVersion } from "./detect.js";

export type CompatReport = {
  readonly drawioVersion: string | null;
  readonly state: "ok" | "below-floor" | "above-window" | "no-version";
  readonly floor: string;
  readonly detail?: string;
};

export function computeCompatReport(): CompatReport {
  const detected = getDetectedDrawioVersion();
  if (!detected.ok) {
    return {
      drawioVersion: detected.raw,
      state: "no-version",
      floor: COMPAT_MATRIX.supportedFloor,
      detail: detected.reason,
    };
  }
  if (isBelowFloor(detected.semver, COMPAT_MATRIX.supportedFloor)) {
    return {
      drawioVersion: detected.raw,
      state: "below-floor",
      floor: COMPAT_MATRIX.supportedFloor,
    };
  }
  // "above-window" only fires for tools whose newest range is bounded. When
  // every tool ships an open-ended newest range, "ok" covers everything above
  // the floor.
  const anyBounded = Object.values(COMPAT_MATRIX.versionedTools).some(
    (entries) => entries.at(-1)?.range.maxExclusive !== null,
  );
  if (anyBounded) {
    const boundedFor = Object.entries(COMPAT_MATRIX.versionedTools).filter(
      ([, entries]) => entries.at(-1)?.range.maxExclusive !== null,
    );
    for (const [, entries] of boundedFor) {
      const newest = entries.at(-1)!;
      const max = parseVersion(newest.range.maxExclusive!);
      if (max) {
        // if detected.semver >= max we're above that tool's window
        if (
          detected.semver[0] > max[0] ||
          (detected.semver[0] === max[0] && detected.semver[1] > max[1]) ||
          (detected.semver[0] === max[0] &&
            detected.semver[1] === max[1] &&
            detected.semver[2] >= max[2])
        ) {
          return {
            drawioVersion: detected.raw,
            state: "above-window",
            floor: COMPAT_MATRIX.supportedFloor,
            detail: newest.range.min,
          };
        }
      }
    }
  }
  return {
    drawioVersion: detected.raw,
    state: "ok",
    floor: COMPAT_MATRIX.supportedFloor,
  };
}

export function sendCompatReport(
  send: (payload: unknown) => void,
  log: (message: string) => void = console.log.bind(console),
): CompatReport {
  const report = computeCompatReport();
  send({ __control: "compat-report", ...report });
  log(
    `[drawio-mcp] drawio version: ${report.drawioVersion ?? "unknown"} — compat state: ${report.state} (floor: ${report.floor})`,
  );
  return report;
}
