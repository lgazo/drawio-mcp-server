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

  it("reports above-window when detected version exceeds any bounded tool's newest range", () => {
    const noop = () => Promise.resolve({ success: false, message: "" });
    const bounded = {
      supportedFloor: "29.0.0",
      versionedTools: {
        "example-tool": [
          { range: { min: "29.0.0", maxExclusive: "30.0.0" }, impl: noop },
          { range: { min: "30.0.0", maxExclusive: "31.0.0" }, impl: noop },
        ],
      },
    };
    (globalThis as any).EditorUi = { VERSION: "31.5.0" };
    const r = computeCompatReport(bounded);
    expect(r.state).toBe("above-window");
    expect(r.drawioVersion).toBe("31.5.0");
    expect(r.detail).toBe("30.0.0");
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
