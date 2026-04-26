import { ToolRegistrar } from "./types.js";
import { registerAddCellOfShapeTool } from "./add-cell-of-shape.js";
import { registerAddEdgeTool } from "./add-edge.js";
import { registerAddRectangleTool } from "./add-rectangle.js";
import { registerCreateLayerTool } from "./create-layer.js";
import { registerDeleteCellByIdTool } from "./delete-cell-by-id.js";
import { registerEditCellTool } from "./edit-cell.js";
import { registerEditEdgeTool } from "./edit-edge.js";
import { registerExportDiagramTool } from "./export-diagram.js";
import { registerGetActiveLayerTool } from "./get-active-layer.js";
import { registerGetSelectedCellTool } from "./get-selected-cell.js";
import { registerGetShapeByNameTool } from "./get-shape-by-name.js";
import { registerGetShapeCategoriesTool } from "./get-shape-categories.js";
import { registerGetShapesInCategoryTool } from "./get-shapes-in-category.js";
import { registerImportDiagramTool } from "./import-diagram.js";
import { registerImportMermaidTool } from "./import-mermaid.js";
import { registerListLayersTool } from "./list-layers.js";
import { registerListPagedModelTool } from "./list-paged-model.js";
import { registerMoveCellToLayerTool } from "./move-cell-to-layer.js";
import { registerSetActiveLayerTool } from "./set-active-layer.js";
import { registerSetCellDataTool } from "./set-cell-data.js";
import { registerSetCellParentTool } from "./set-cell-parent.js";
import { registerSetCellShapeTool } from "./set-cell-shape.js";

const registrars: ToolRegistrar[] = [
  registerGetSelectedCellTool,
  registerAddRectangleTool,
  registerAddEdgeTool,
  registerDeleteCellByIdTool,
  registerGetShapeCategoriesTool,
  registerGetShapesInCategoryTool,
  registerGetShapeByNameTool,
  registerAddCellOfShapeTool,
  registerSetCellShapeTool,
  registerSetCellDataTool,
  registerEditCellTool,
  registerEditEdgeTool,
  registerListPagedModelTool,
  registerListLayersTool,
  registerSetActiveLayerTool,
  registerMoveCellToLayerTool,
  registerSetCellParentTool,
  registerGetActiveLayerTool,
  registerCreateLayerTool,
  registerExportDiagramTool,
  registerImportDiagramTool,
  registerImportMermaidTool,
];

export function registerTools(...args: Parameters<ToolRegistrar>) {
  for (const register of registrars) {
    register(...args);
  }
}
