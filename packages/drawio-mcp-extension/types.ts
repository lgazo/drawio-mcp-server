/**
  EXTENSION
*/

export const bus_request_stream = "BUS_REQUEST";
export const bus_reply_stream = "BUS_REPLY";

export type OptionKey = string;

export type BusListener<RQ> = (request: RQ) => void;

export type SendReplyToServer = <RL>(reply: RL) => void;
export type OnRequestFromServer = <RQ>(
  event_name: string,
  listener: BusListener<RQ>,
) => void;
export type OnStandardToolRequestFromServer = (
  event_name: string,
  ui: DrawioUI,
  accepted_option_keys: Set<OptionKey>,
  drawio_function: DrawIOFunction,
) => void;

export type DrawioCellOptions = Record<OptionKey, unknown>;

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
  // Add other graph methods as needed
}

// Editor interface for the UI's editor property
export interface DrawioEditor {
  graph: DrawioGraph;
  // Add other editor properties as needed
}

// UI interface for the loadPlugin callback parameter
export interface DrawioUI {
  editor: DrawioEditor;
  // Add other UI properties as needed
}

export interface Draw {
  loadPlugin: (callback: (ui: DrawioUI) => void) => void;
}

export type MxGraphCell = any;
export type MxGraphIsLayer = (cell: MxGraphCell) => boolean;

// Extend the Window interface to include the Draw property
declare global {
  interface Window {
    Draw?: Draw;
    mxUtils?: any;
  }
}
