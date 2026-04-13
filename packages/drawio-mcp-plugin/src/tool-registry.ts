import type { DrawIOFunction } from "./types.js";
import {
  add_cell_of_shape,
  add_edge,
  add_new_rectangle,
  assert_target_document_active,
  create_layer,
  create_page,
  delete_cell_by_id,
  edit_cell,
  edit_edge,
  export_diagram,
  get_active_layer,
  get_current_page,
  get_selected_cell,
  get_shape_by_name,
  get_shape_categories,
  get_shapes_in_category,
  import_diagram,
  list_layers,
  list_pages,
  list_paged_model,
  mark_page_execution_modified,
  move_cell_to_layer,
  prepare_target_page_execution,
  type PageExecutionPolicy,
  rename_page,
  set_active_layer,
  set_cell_data,
  set_cell_parent,
  set_cell_shape,
  type DrawioCellOptions,
} from "./drawio-tools.js";

export type ToolDefinition = {
  name: string;
  params: Set<string>;
  handler: DrawIOFunction;
  pageExecution?: PageExecutionPolicy;
};

function with_target_page(
  handler: DrawIOFunction,
  options?: {
    skip?: (options: DrawioCellOptions) => boolean;
    pageExecution?: PageExecutionPolicy;
  },
): DrawIOFunction {
  return (ui, rawOptions) => {
    const drawioOptions = rawOptions as DrawioCellOptions;

    if (!options?.skip?.(drawioOptions)) {
      const pageExecution = options?.pageExecution;
      const preferBackground =
        pageExecution?.mode === "background-page" ||
        (pageExecution?.mode === "hybrid-page" &&
          pageExecution.allow_background?.(drawioOptions) === true);
      const execution = prepare_target_page_execution(ui, drawioOptions.target_page, {
        prefer_background: preferBackground,
        sync_live_current_page_state:
          pageExecution?.sync_live_current_page_state === true,
      });

      try {
        const result = handler(execution.ui, drawioOptions);

        if (
          result &&
          typeof result === "object" &&
          typeof (result as Promise<unknown>).finally === "function"
        ) {
          return (result as Promise<unknown>).finally(() => {
            if (pageExecution?.mutates) {
              mark_page_execution_modified(ui, execution);
            }
            execution.cleanup();
          });
        }

        if (pageExecution?.mutates) {
          mark_page_execution_modified(ui, execution);
        }

        execution.cleanup();
        return result;
      } catch (error) {
        if (pageExecution?.mutates) {
          mark_page_execution_modified(ui, execution);
        }
        execution.cleanup();
        throw error;
      }
    }

    return handler(ui, drawioOptions);
  };
}

function with_target_document(handler: DrawIOFunction): DrawIOFunction {
  return (ui, rawOptions) => {
    const drawioOptions = rawOptions as DrawioCellOptions;
    assert_target_document_active(drawioOptions.target_document);
    return handler(ui, rawOptions);
  };
}

const rawToolDefinitions: ToolDefinition[] = [
  {
    name: "get-selected-cell",
    params: new Set(["target_page"]),
    handler: with_target_page(get_selected_cell, {
      pageExecution: {
        mode: "visible-page",
      },
    }),
    pageExecution: {
      mode: "visible-page",
    },
  },
  {
    name: "add-rectangle",
    params: new Set([
      "x",
      "y",
      "width",
      "height",
      "text",
      "style",
      "parent_id",
      "target_page",
    ]),
    handler: with_target_page(add_new_rectangle, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "add-edge",
    params: new Set([
      "source_id",
      "target_id",
      "style",
      "text",
      "parent_id",
      "points",
      "target_page",
    ]),
    handler: with_target_page(add_edge, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "delete-cell-by-id",
    params: new Set(["cell_id", "target_page"]),
    handler: with_target_page(delete_cell_by_id, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "get-shape-categories",
    params: new Set<string>([]),
    handler: get_shape_categories,
  },
  {
    name: "get-shapes-in-category",
    params: new Set(["category_id"]),
    handler: get_shapes_in_category,
  },
  {
    name: "get-shape-by-name",
    params: new Set(["shape_name"]),
    handler: get_shape_by_name,
  },
  {
    name: "add-cell-of-shape",
    params: new Set([
      "shape_name",
      "x",
      "y",
      "width",
      "height",
      "text",
      "style",
      "parent_id",
      "target_page",
    ]),
    handler: with_target_page(add_cell_of_shape, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "set-cell-shape",
    params: new Set(["cell_id", "shape_name", "target_page"]),
    handler: with_target_page(set_cell_shape, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "set-cell-data",
    params: new Set(["cell_id", "key", "value", "target_page"]),
    handler: with_target_page(set_cell_data, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "list-paged-model",
    params: new Set(["page", "page_size", "filter", "target_page"]),
    handler: with_target_page(list_paged_model, {
      pageExecution: {
        mode: "background-page",
      },
    }),
    pageExecution: {
      mode: "background-page",
    },
  },
  {
    name: "edit-cell",
    params: new Set([
      "cell_id",
      "text",
      "x",
      "y",
      "width",
      "height",
      "style",
      "target_page",
    ]),
    handler: with_target_page(edit_cell, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "edit-edge",
    params: new Set([
      "cell_id",
      "text",
      "source_id",
      "target_id",
      "style",
      "points",
      "target_page",
    ]),
    handler: with_target_page(edit_edge, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "list-layers",
    params: new Set(["target_page"]),
    handler: with_target_page(list_layers, {
      pageExecution: {
        mode: "background-page",
      },
    }),
    pageExecution: {
      mode: "background-page",
    },
  },
  {
    name: "set-active-layer",
    params: new Set(["layer_id", "target_page"]),
    handler: with_target_page(set_active_layer, {
      pageExecution: {
        mode: "visible-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "visible-page",
      mutates: true,
    },
  },
  {
    name: "move-cell-to-layer",
    params: new Set(["cell_id", "target_layer_id", "target_page"]),
    handler: with_target_page(move_cell_to_layer, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "set-cell-parent",
    params: new Set(["cell_id", "parent_id", "target_page"]),
    handler: with_target_page(set_cell_parent, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "get-active-layer",
    params: new Set(["target_page"]),
    handler: with_target_page(get_active_layer, {
      pageExecution: {
        mode: "visible-page",
      },
    }),
    pageExecution: {
      mode: "visible-page",
    },
  },
  {
    name: "create-layer",
    params: new Set(["name", "target_page"]),
    handler: with_target_page(create_layer, {
      pageExecution: {
        mode: "background-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "background-page",
      mutates: true,
    },
  },
  {
    name: "export-diagram",
    params: new Set([
      "format",
      "scale",
      "border",
      "background",
      "shadow",
      "crop",
      "selection_only",
      "transparent",
      "dpi",
      "embed_xml",
      "size",
      "target_page",
    ]),
    handler: with_target_page(export_diagram, {
      pageExecution: {
        mode: "hybrid-page",
        allow_background: (options) => {
          const format = options.format ?? "xml";
          const hasEmbeddedPng =
            options.embed_xml === true && format === "png";

          return (
            options.selection_only !== true &&
            options.size !== "selection" &&
            !hasEmbeddedPng
          );
        },
        sync_live_current_page_state: true,
      },
    }),
    pageExecution: {
      mode: "hybrid-page",
      allow_background: (options) => {
        const format = options.format ?? "xml";
        const hasEmbeddedPng =
          options.embed_xml === true && format === "png";

        return (
          options.selection_only !== true &&
          options.size !== "selection" &&
          !hasEmbeddedPng
        );
      },
      sync_live_current_page_state: true,
    },
  },
  {
    name: "import-diagram",
    params: new Set(["data", "format", "mode", "filename", "target_page"]),
    handler: with_target_page(import_diagram, {
      skip: (options) => options.mode === "new-page",
      pageExecution: {
        mode: "visible-page",
        mutates: true,
      },
    }),
    pageExecution: {
      mode: "visible-page",
      mutates: true,
    },
  },
  {
    name: "list-pages",
    params: new Set<string>([]),
    handler: list_pages,
  },
  {
    name: "get-current-page",
    params: new Set<string>([]),
    handler: get_current_page,
  },
  {
    name: "create-page",
    params: new Set(["name"]),
    handler: create_page,
  },
  {
    name: "rename-page",
    params: new Set(["page", "name"]),
    handler: rename_page,
  },
];

export const toolDefinitions: ToolDefinition[] = rawToolDefinitions.map(
  (definition) => ({
    ...definition,
    params: new Set(["target_document", ...definition.params]),
    handler: with_target_document(definition.handler),
  }),
);
