import { import_diagram } from "../../drawio-tools.js";

export type ImportMermaidOptions = {
  mermaid_source: string;
  mode?: "native" | "embed";
  insert_mode?: "replace" | "add" | "new-page";
};

export type ImportMermaidResult =
  | {
      success: true;
      mode: "native" | "embed";
      message: string;
      cells?: number;
      xml?: string;
    }
  | { success: false; message: string };

export function validateOptions(
  options: Record<string, unknown>,
):
  | {
      source: string;
      mode: "native" | "embed";
      insertMode: "replace" | "add" | "new-page";
    }
  | ImportMermaidResult {
  const opts = options as unknown as ImportMermaidOptions;
  const source = opts.mermaid_source;
  if (!source || typeof source !== "string") {
    return {
      success: false,
      message: "mermaid_source must be a non-empty string",
    };
  }
  return {
    source,
    mode: opts.mode ?? "native",
    insertMode: opts.insert_mode ?? "add",
  };
}

export function runInsertFlow(
  ui: any,
  mode: "native" | "embed",
  insertMode: "replace" | "add" | "new-page",
  resolve: (result: ImportMermaidResult) => void,
): {
  onXml: (xml: string) => void;
  onError: (err: any) => void;
} {
  let settled = false;
  const settle = (result: ImportMermaidResult) => {
    if (settled) return;
    settled = true;
    resolve(result);
  };

  const onXml = (xml: string) => {
    if (!xml || typeof xml !== "string") {
      settle({ success: false, message: "Mermaid parser returned empty XML" });
      return;
    }
    try {
      const importResult = import_diagram(ui, {
        data: xml,
        format: "xml",
        mode: insertMode,
      });
      if (!importResult.success) {
        settle({
          success: false,
          message: `Mermaid converted, but inserting into the diagram failed: ${importResult.message}`,
        });
        return;
      }
      settle({
        success: true,
        mode,
        message: importResult.message,
        cells: importResult.cells,
        xml,
      });
    } catch (err) {
      settle({
        success: false,
        message: `Insert after Mermaid conversion failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const onError = (err: any) => {
    settle({
      success: false,
      message: `Mermaid render failed: ${err?.message ?? String(err)}`,
    });
  };

  return { onXml, onError };
}
