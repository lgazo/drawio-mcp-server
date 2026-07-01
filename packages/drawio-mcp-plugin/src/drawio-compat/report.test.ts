import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { computeCompatReport, sendCompatReport } from "./report.js";
import { resetDetectedDrawioVersionCache } from "./detect.js";

const g = globalThis as any;

describe("computeCompatReport", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("reports ok for supported version", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    const r = computeCompatReport();
    expect(r.state).toBe("ok");
    expect(r.drawioVersion).toBe("30.2.6");
  });

  it("reports below-floor for old drawio", () => {
    g.EditorUi = { VERSION: "28.0.0" };
    const r = computeCompatReport();
    expect(r.state).toBe("below-floor");
    expect(r.floor).toBe("29.0.0");
  });

  it("reports no-version when detection fails", () => {
    const r = computeCompatReport();
    expect(r.state).toBe("no-version");
    expect(r.drawioVersion).toBeNull();
  });
});

describe("sendCompatReport", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("emits a `compat-report` control message", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    const send = jest.fn();
    const log = jest.fn();
    const report = sendCompatReport(send, log);
    expect(send).toHaveBeenCalledWith({
      __control: "compat-report",
      ...report,
    });
    expect(log).toHaveBeenCalled();
  });
});
