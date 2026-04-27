/**
 * Shared type definitions for Draw.io MCP Plugin
 * Used by both the plugin (standalone) and extension integration
 */

import { DrawioCellOptions, TransformedCell } from "./drawio-tools.js";

export type OptionKey = string;
export type { DrawioCellOptions, TransformedCell };

export type DrawIOFunction = (
  ui: DrawioUI,
  options: any,
) => unknown;

export type DrawioEventListener = (...args: any[]) => void;

export interface DrawioEventSource {
  addListener?: (eventName: string, listener: DrawioEventListener) => void;
  removeListener?: (eventName: string, listener: DrawioEventListener) => void;
}

export interface DrawioPage {
  node?: any;
  graphModelNode?: any;
  viewState?: any;
  root?: any;
  diagramModified?: boolean;
  getId?: () => string;
  getName?: () => string;
  setName?: (name: string) => void;
  setDiagramModified?: (modified: boolean) => void;
  isDiagramModified?: () => boolean;
}

/**
 * Draw.io API type definitions
 */

// Graph interface for the editor's graph property
export interface DrawioGraph {
  getLayerForCell(cell: MxGraphCell): MxGraphCell;
  getSelectionCell: () => any;
  getModel: () => any;
  getView: () => any;
  getGraphBounds: () => any;
  getSelectionCells: () => any[];
  getSvg(
    background: any,
    scale: number,
    border: number,
    noCrop?: boolean,
    pageId?: any,
    ignoreSelection?: boolean,
    addHyperlink?: boolean,
    imgExport?: any,
    linkTarget?: any,
    shadow?: boolean,
    keepDpi?: boolean,
    theme?: string,
    exportType?: string,
  ): any;
  shadowVisible?: boolean;
  background?: string;
  isSelectionEmpty(): boolean;
}

// Editor interface for the UI's editor property
export interface DrawioEditor {
  graph: DrawioGraph;
  getGraphXml: (ignoreSelection?: boolean, resolveReferences?: boolean) => any;
  setGraphXml?: (node: any) => void;
}

export interface DrawioFile extends DrawioEventSource {
  getTitle?: () => string;
  getMode?: () => string | null;
  getHash?: () => string;
  getFileUrl?: () => string | null;
}

// UI interface for the loadPlugin callback parameter
export interface DrawioUI {
  editor: DrawioEditor & DrawioEventSource;
  menus?: any;
  actions?: any;
  pages?: DrawioPage[];
  currentPage?: DrawioPage;
  sidebar?: any;
  insertPage?: (page?: DrawioPage | null, index?: number, noSelect?: boolean) => DrawioPage | null;
  selectPage?: (page: DrawioPage, force?: boolean, noSelect?: boolean) => void;
  removePage?: (page: DrawioPage) => void;
  renamePage?: (page: DrawioPage) => void;
  movePage?: (oldIndex: number, newIndex: number) => void;
  duplicatePage?: (page: DrawioPage, newName?: string) => DrawioPage | null;
  getXmlFileData(ignoreSelection?: boolean, currentPage?: boolean, uncompressed?: boolean, resolveReferences?: boolean): any;
  getFileData(
    forceXml?: boolean,
    forceSvg?: boolean,
    forceHtml?: boolean,
    embeddedCallback?: any,
    ignoreSelection?: boolean,
    currentPage?: boolean,
    node?: any,
    compact?: boolean,
    file?: any,
    uncompressed?: boolean,
    resolveReferences?: boolean,
    scale?: number,
    border?: number,
  ): string;
  getEmbeddedSvg(
    xml: string,
    graph: DrawioGraph,
    url?: string,
    noHeader?: boolean,
    callback?: any,
    ignoreSelection?: boolean,
    redirect?: string,
    embedImages?: boolean,
    background?: string,
    scale?: number,
    border?: number,
    shadow?: boolean,
    theme?: string,
  ): string;
  exportToCanvas(
    callback: (canvas: HTMLCanvasElement) => void,
    width?: number,
    imageCache?: any,
    background?: string,
    error?: (e: any) => void,
    limitHeight?: number,
    ignoreSelection?: boolean,
    scale?: number,
    transparentBackground?: boolean,
    addShadow?: boolean,
    converter?: any,
    graph?: DrawioGraph,
    border?: number,
    noCrop?: boolean,
    grid?: boolean,
    theme?: string,
    exportType?: string,
  ): void;
  createImageDataUri(canvas: HTMLCanvasElement, xml: string | null, format: string, dpi?: number): string;
  getCurrentFile(): DrawioFile | null;
  embedFonts(svgRoot: any, callback: (svgRoot: any) => void): void;
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
    mxCodec?: any;
    Graph?: any;
    Editor?: any;
  }
}
