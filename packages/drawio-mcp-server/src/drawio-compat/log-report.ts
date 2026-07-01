import type { Logger } from "../types.js";

export type CompatReportPayload = {
  readonly drawioVersion: string | null;
  readonly state: "ok" | "below-floor" | "above-window" | "no-version" | string;
  readonly floor: string;
  readonly detail?: string;
};

export function handleCompatReport(
  payload: CompatReportPayload,
  log: Logger,
): void {
  const v = payload.drawioVersion ?? "unknown";
  switch (payload.state) {
    case "ok":
      log.log("info", `drawio v${v} is within supported window`);
      return;
    case "below-floor":
      log.log(
        "error",
        `drawio v${v} predates supported floor v${payload.floor}; ` +
          `version-gated tools will return errors`,
      );
      return;
    case "above-window":
      log.log(
        "warning",
        `drawio v${v} is newer than the tested window ` +
          `(last tested min: v${payload.detail ?? "?"}); running on newest impl`,
      );
      return;
    case "no-version":
      log.log(
        "warning",
        `plugin could not detect drawio version (${payload.detail ?? "?"})`,
      );
      return;
    default:
      log.log(
        "warning",
        `unknown compat state \`${payload.state}\` (drawio v${v})`,
      );
  }
}
