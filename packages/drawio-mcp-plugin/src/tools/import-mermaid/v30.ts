import type { ImportMermaidResult } from "./shared.js";
import { runInsertFlow, validateOptions } from "./shared.js";

export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
): Promise<ImportMermaidResult> {
  const validated = validateOptions(options);
  if ("success" in validated) return Promise.resolve(validated);

  const { source, mode, insertMode } = validated;

  if (typeof ui?.parseMermaidDiagram !== "function") {
    return Promise.resolve({
      success: false,
      message:
        "ui.parseMermaidDiagram is not available; this Draw.io build does not expose Mermaid support.",
    });
  }

  return new Promise((resolve) => {
    const { onXml, onError } = runInsertFlow(ui, mode, insertMode, resolve);
    try {
      if (mode === "embed" && typeof ui.parseMermaidImage === "function") {
        ui.parseMermaidImage(source, onXml, onError);
      } else {
        ui.parseMermaidDiagram(source, undefined, onXml, onError, onError);
      }
    } catch (err) {
      resolve({
        success: false,
        message: `parseMermaidDiagram threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
