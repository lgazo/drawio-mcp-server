import { isBelowFloor, parseVersion } from "drawio-mcp-compat";
import { COMPAT_MATRIX } from "./matrix.js";
import { getDetectedDrawioVersion } from "./detect.js";

export type CompatReport = {
  readonly drawioVersion: string | null;
  readonly state: "ok" | "below-floor" | "above-window" | "no-version";
  readonly floor: string;
  readonly detail?: string;
};

export interface CompatMatrix {
  readonly supportedFloor: string;
  readonly versionedTools: Record<string, Array<{ readonly range: { readonly min: string; readonly maxExclusive: string | null }; readonly impl: () => Promise<unknown> }>>;
}

export function computeCompatReport(matrix: typeof COMPAT_MATRIX = COMPAT_MATRIX): CompatReport {
  const detected = getDetectedDrawioVersion();
  if (!detected.ok) {
    return {
      drawioVersion: detected.raw,
      state: "no-version",
      floor: matrix.supportedFloor,
      detail: detected.reason,
    };
  }
  if (isBelowFloor(detected.semver, matrix.supportedFloor)) {
    return {
      drawioVersion: detected.raw,
      state: "below-floor",
      floor: matrix.supportedFloor,
    };
  }
  // above-window: any bounded tool's newest range excluded. If even one tool
  // would be dispatched to an out-of-window impl, the rollup state warns —
  // matches dispatchTool's per-tool "above-window" outcome. Unreachable today
  // (all newest ranges are open-ended); a test below covers the semantics
  // via an injected bounded matrix.
  const anyBounded = Object.values(matrix.versionedTools).some(
    (entries) => entries.at(-1)?.range.maxExclusive !== null,
  );
  if (anyBounded) {
    const boundedFor = Object.entries(matrix.versionedTools).filter(
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
            floor: matrix.supportedFloor,
            detail: newest.range.min,
          };
        }
      }
    }
  }
  return {
    drawioVersion: detected.raw,
    state: "ok",
    floor: matrix.supportedFloor,
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
