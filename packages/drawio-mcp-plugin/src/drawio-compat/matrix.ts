import type { VersionRange } from "drawio-mcp-compat";

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
    // populated by Task 4 (import-mermaid)
  },
};
