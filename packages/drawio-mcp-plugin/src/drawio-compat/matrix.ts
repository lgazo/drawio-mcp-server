import type { VersionRange } from "drawio-mcp-compat";
import { import_mermaid as importMermaidV29 } from "../tools/import-mermaid/v29.js";
import { import_mermaid as importMermaidV30 } from "../tools/import-mermaid/v30.js";

export type ToolImpl = (
  ui: any,
  options: Record<string, unknown>,
) => unknown;

export type ToolVersionEntry = {
  readonly range: VersionRange;
  readonly impl: ToolImpl;
};

export type CompatMatrix = {
  readonly supportedFloor: string;
  readonly versionedTools: Readonly<
    Record<string, readonly ToolVersionEntry[]>
  >;
};

export const COMPAT_MATRIX: CompatMatrix = {
  supportedFloor: "29.0.0",
  versionedTools: {
    "import-mermaid": [
      {
        range: { min: "29.0.0", maxExclusive: "30.0.0" },
        impl: importMermaidV29,
      },
      {
        range: { min: "30.0.0", maxExclusive: null },
        impl: importMermaidV30,
      },
    ],
  },
};
