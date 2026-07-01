import { getDetectedDrawioVersion } from "../../drawio-compat/detect.js";
import { dispatchTool } from "../../drawio-compat/dispatch.js";
import { COMPAT_MATRIX } from "../../drawio-compat/matrix.js";
import type { ImportMermaidResult } from "./shared.js";

const TOOL_NAME = "import-mermaid";

export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
): Promise<ImportMermaidResult> {
  const detected = getDetectedDrawioVersion(ui);
  const outcome = dispatchTool(TOOL_NAME, detected, COMPAT_MATRIX);

  if (outcome === null) {
    // Should not happen — matrix.ts registers this tool. Defensive fallback:
    return Promise.resolve({
      success: false,
      message: `import-mermaid has no matrix entry; refusing to guess.`,
    });
  }

  switch (outcome.kind) {
    case "matched":
      return outcome.impl(ui, options) as Promise<ImportMermaidResult>;
    case "above-window": {
      const entries = COMPAT_MATRIX.versionedTools[TOOL_NAME] ?? [];
      const fallback = entries.at(-1);
      if (!fallback) {
        return Promise.resolve({
          success: false,
          message: `no impl available for drawio v${outcome.detected}`,
        });
      }
      return fallback.impl(ui, options) as Promise<ImportMermaidResult>;
    }
    case "below-floor":
      return Promise.resolve({
        success: false,
        message: `drawio v${outcome.detected} predates supported floor v${outcome.floor}. Upgrade drawio.`,
      });
    case "no-version":
      return Promise.resolve({
        success: false,
        message: `cannot detect drawio version (${outcome.reason}); pin a supported drawio build.`,
      });
  }
}
