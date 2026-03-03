/**
 * Shared type definitions for Draw.io MCP Plugin
 * Used by both the plugin (standalone) and extension integration
 */

import { DrawioCellOptions } from "./drawio-tools.js";

export type OptionKey = string;
export type { DrawioCellOptions };

export type DrawIOFunction = (
  ui: DrawioUI,
  options: DrawioCellOptions,
) => unknown;

/**
 * Draw.io API type definitions
 */

// Graph interface for the editor's graph property
export interface DrawioGraph {
  getLayerForCell(cell: MxGraphCell): MxGraphCell;
  getSelectionCell: () => any;
}

// Editor interface for the UI's editor property
export interface DrawioEditor {
  graph: DrawioGraph;
}

// UI interface for the loadPlugin callback parameter
export interface DrawioUI {
  editor: DrawioEditor;
  menus?: any;
  actions?: any;
}

export interface Draw {
  loadPlugin: (callback: (ui: DrawioUI) => void) => void;
}

export type MxGraphCell = any;
export type MxGraphIsLayer = (cell: MxGraphCell) => boolean;

// Note: DrawioCellOptions is exported from drawio-tools.ts

// Extend the Window interface to include Draw.io properties
declare global {
  interface Window {
    Draw?: Draw;
    mxUtils?: any;
    mxCell?: any;
  }
}
