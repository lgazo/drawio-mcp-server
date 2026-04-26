import {
  add_cell_of_shape,
  add_edge,
  add_new_rectangle,
  delete_cell_by_id,
  edit_cell,
  edit_edge,
  set_cell_shape,
  set_cell_data,
  get_shape_by_name,
  get_shape_categories,
  get_shapes_in_category,
  list_paged_model,
  list_layers,
  set_active_layer,
  move_cell_to_layer,
  get_active_layer,
  create_layer,
  export_diagram,
  import_diagram,
  import_mermaid,
} from "drawio-mcp-plugin";
import { on_standard_tool_request_from_server } from "../bus";
import type { DrawioUI, DrawIOFunction } from "../types";

export default defineUnlistedScript(() => {
  console.log("Hello from the main world");
  const checkInterval = setInterval(() => {
    if (window.Draw) {
      clearInterval(checkInterval);
      window.Draw.loadPlugin((ui: DrawioUI) => {
        console.log("plugin loaded", ui);
        const { editor } = ui;
        const { graph } = editor;

        //TODO: just for testing / exploring Draw.io
        // window.ui = ui;
        // window.editor = editor;
        // window.graph = graph;

        const TOOL_get_selected_cell = "get-selected-cell";
        on_standard_tool_request_from_server(
          TOOL_get_selected_cell,
          ui,
          new Set([]),
          (ui, _options) => {
            const result = graph.getSelectionCell() || "no cell selected";
            return result;
          },
        );

        const TOOL_add_rectangle = "add-rectangle";
        on_standard_tool_request_from_server(
          TOOL_add_rectangle,
          ui,
          new Set(["x", "y", "width", "height", "text", "style"]),
          add_new_rectangle,
        );

        const TOOL_delete_cell_by_id = "delete-cell-by-id";
        on_standard_tool_request_from_server(
          TOOL_delete_cell_by_id,
          ui,
          new Set(["cell_id"]),
          delete_cell_by_id,
        );

        const TOOL_add_edge = "add-edge";
        on_standard_tool_request_from_server(
          TOOL_add_edge,
          ui,
          new Set(["source_id", "target_id", "style", "text"]),
          add_edge,
        );

        const TOOL_get_shape_categories = "get-shape-categories";
        on_standard_tool_request_from_server(
          TOOL_get_shape_categories,
          ui,
          new Set([]),
          get_shape_categories,
        );

        const TOOL_get_shapes_in_category = "get-shapes-in-category";
        on_standard_tool_request_from_server(
          TOOL_get_shapes_in_category,
          ui,
          new Set(["category_id"]),
          get_shapes_in_category,
        );

        const TOOL_get_shape_by_name = "get-shape-by-name";
        on_standard_tool_request_from_server(
          TOOL_get_shape_by_name,
          ui,
          new Set(["shape_name"]),
          get_shape_by_name,
        );

        const TOOL_add_cell_of_shape = "add-cell-of-shape";
        on_standard_tool_request_from_server(
          TOOL_add_cell_of_shape,
          ui,
          new Set(["x", "y", "width", "height", "text", "style"]),
          add_cell_of_shape,
        );

        const TOOL_set_cell_shape = "set-cell-shape";
        on_standard_tool_request_from_server(
          TOOL_set_cell_shape,
          ui,
          new Set(["cell_id", "shape_name"]),
          set_cell_shape,
        );

        const TOOL_set_cell_data = "set-cell-data";
        on_standard_tool_request_from_server(
          TOOL_set_cell_data,
          ui,
          new Set(["cell_id", "key", "value"]),
          set_cell_data,
        );

        const TOOL_list_paged_model = "list-paged-model";
        on_standard_tool_request_from_server(
          TOOL_list_paged_model,
          ui,
          new Set(["page", "page_size", "filter", "filter.parent_ids", "filter.layer_ids", "filter.ids"]),
          list_paged_model,
        );

        const TOOL_edit_cell = "edit-cell";
        on_standard_tool_request_from_server(
          TOOL_edit_cell,
          ui,
          new Set(["cell_id", "text", "x", "y", "width", "height", "style"]),
          edit_cell,
        );

        const TOOL_edit_edge = "edit-edge";
        on_standard_tool_request_from_server(
          TOOL_edit_edge,
          ui,
          new Set(["cell_id", "text", "source_id", "target_id", "style"]),
          edit_edge,
        );

        // Layer Management Tools
        const TOOL_list_layers = "list-layers";
        on_standard_tool_request_from_server(
          TOOL_list_layers,
          ui,
          new Set([]),
          list_layers,
        );

        const TOOL_set_active_layer = "set-active-layer";
        on_standard_tool_request_from_server(
          TOOL_set_active_layer,
          ui,
          new Set(["layer_id"]),
          set_active_layer,
        );

        const TOOL_move_cell_to_layer = "move-cell-to-layer";
        on_standard_tool_request_from_server(
          TOOL_move_cell_to_layer,
          ui,
          new Set(["cell_id", "target_layer_id"]),
          move_cell_to_layer,
        );

        const TOOL_get_active_layer = "get-active-layer";
        on_standard_tool_request_from_server(
          TOOL_get_active_layer,
          ui,
          new Set([]),
          get_active_layer,
        );

        const TOOL_create_layer = "create-layer";
        on_standard_tool_request_from_server(
          TOOL_create_layer,
          ui,
          new Set(["name"]),
          create_layer,
        );

        const TOOL_export_diagram = "export-diagram";
        on_standard_tool_request_from_server(
          TOOL_export_diagram,
          ui,
          new Set(["format", "scale", "border", "background", "shadow", "crop", "selection_only", "transparent", "dpi", "embed_xml", "size"]),
          export_diagram as DrawIOFunction,
        );

        const TOOL_import_diagram = "import-diagram";
        on_standard_tool_request_from_server(
          TOOL_import_diagram,
          ui,
          new Set(["data", "format", "mode", "filename"]),
          import_diagram as DrawIOFunction,
        );

        const TOOL_import_mermaid = "import-mermaid";
        on_standard_tool_request_from_server(
          TOOL_import_mermaid,
          ui,
          new Set(["mermaid_source", "mode", "insert_mode"]),
          import_mermaid as DrawIOFunction,
        );
      });
    } else {
      const el = document.querySelector(
        "body > div.geMenubarContainer > div.geMenubar > div > button",
      );
      if (el) {
        el.innerHTML = Date.now().toString();
      }
    }
  }, 1000);
});
