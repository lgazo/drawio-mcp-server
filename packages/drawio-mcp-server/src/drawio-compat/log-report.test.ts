import { describe, expect, it, jest } from "@jest/globals";
import { handleCompatReport } from "./log-report.js";

function makeLogger() {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    logger: { log: (lvl: string, msg: string) => calls.push([lvl, msg]) } as any,
  };
}

describe("handleCompatReport", () => {
  it("emits info for ok state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      { drawioVersion: "30.2.6", state: "ok", floor: "29.0.0" },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "info")).toBe(true);
  });

  it("emits error for below-floor state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      { drawioVersion: "28.0.0", state: "below-floor", floor: "29.0.0" },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "error")).toBe(true);
  });

  it("emits warning for above-window state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      {
        drawioVersion: "31.0.0",
        state: "above-window",
        floor: "29.0.0",
        detail: "30.0.0",
      },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "warning")).toBe(true);
  });

  it("emits warning for no-version state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      { drawioVersion: null, state: "no-version", floor: "29.0.0", detail: "missing" },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "warning")).toBe(true);
  });
});
