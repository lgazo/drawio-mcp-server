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
  remove_circular_dependencies,
  list_layers,
  set_active_layer,
  move_cell_to_layer,
  get_active_layer,
  create_layer,
  export_diagram,
  import_diagram,
  import_mermaid,
  readPluginConfig,
  writePluginConfig,
  buildWebSocketUrl,
  createWebSocketManager,
  createSettingsDialog,
  showSettingsDialog,
  hideSettingsDialog,
  reply_name,
} from "drawio-mcp-plugin";
import type {
  WebSocketManager,
  PluginConfig,
  SettingsDialogState,
  SettingsDialogActions,
} from "drawio-mcp-plugin";
import { DrawioUI } from "../types";

/**
 * Functional tool handler factory
 * Creates handlers that match server requests with tool execution
 */
const createToolHandler = (
  toolName: string,
  parameterKeys: Set<string>,
  executeFunction: (ui: DrawioUI, options: Record<string, unknown>) => unknown
) => {
  return (request: any): any => {
    const optionEntries = Object.entries(request).filter(([key, _value]) => {
      return parameterKeys.has(key);
    });

    const options = optionEntries.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, unknown>);

    const buildSuccessReply = (result: unknown) => ({
      __event: reply_name(toolName, request.__request_id),
      __request_id: request.__request_id,
      success: true,
      result: remove_circular_dependencies(result),
    });

    const buildErrorReply = (error: unknown) => ({
      __event: reply_name(toolName, request.__request_id),
      __request_id: request.__request_id,
      success: false,
      error: remove_circular_dependencies(error),
    });

    const sendReply = (reply: any) => {
      if (wsManager) {
        wsManager.send(reply);
      }
    };

    try {
      const result = executeFunction(ui, options);

      if (result && typeof result === "object" && typeof (result as any).then === "function") {
        (result as Promise<unknown>)
          .then((resolved) => {
            const reply = buildSuccessReply(resolved);
            sendReply(reply);
            return reply;
          })
          .catch((error) => {
            console.error(`[plugin] Async tool ${toolName} failed for request ID ${request.__request_id}:`, error);
            const reply = buildErrorReply(error);
            sendReply(reply);
            return reply;
          });
        return; // Reply will be sent asynchronously
      }

      const reply = buildSuccessReply(result);
      sendReply(reply);
      return reply;
    } catch (error) {
      console.error(`[plugin] Tool ${toolName} failed for request ID ${request.__request_id}:`, error);
      const reply = buildErrorReply(error);
      sendReply(reply);
      return reply;
    }
  };
};

let ui: DrawioUI;
let wsManager: WebSocketManager | null = null;
let settingsDialog: { element: HTMLElement; update: (state: SettingsDialogState) => void } | null = null;

// Tool registrations (pure function definitions for consistency)
const toolDefinitions = [
  {
    name: "get-selected-cell",
    params: new Set<string>([]),
    handler: (ui: DrawioUI, _options: Record<string, unknown>) => {
      return ui.editor.graph.getSelectionCell() || "no cell selected";
    }
  },
  {
    name: "add-rectangle",
    params: new Set(["x", "y", "width", "height", "text", "style"]),
    handler: add_new_rectangle
  },
  {
    name: "delete-cell-by-id",
    params: new Set(["cell_id"]),
    handler: delete_cell_by_id
  },
  {
    name: "add-edge",
    params: new Set(["source_id", "target_id", "style", "text"]),
    handler: add_edge
  },
  {
    name: "get-shape-categories",
    params: new Set([]),
    handler: get_shape_categories
  },
  {
    name: "get-shapes-in-category",
    params: new Set(["category_id"]),
    handler: get_shapes_in_category
  },
  {
    name: "get-shape-by-name",
    params: new Set(["shape_name"]),
    handler: get_shape_by_name
  },
  {
    name: "add-cell-of-shape",
    params: new Set(["x", "y", "width", "height", "text", "style"]),
    handler: add_cell_of_shape
  },
  {
    name: "set-cell-shape",
    params: new Set(["cell_id", "shape_name"]),
    handler: set_cell_shape
  },
  {
    name: "set-cell-data",
    params: new Set(["cell_id", "key", "value"]),
    handler: set_cell_data
  },
  {
    name: "list-paged-model",
    params: new Set(["page", "page_size", "filter"]),
    handler: list_paged_model
  },
  {
    name: "edit-cell",
    params: new Set(["cell_id", "text", "x", "y", "width", "height", "style"]),
    handler: edit_cell
  },
  {
    name: "edit-edge",
    params: new Set(["cell_id", "text", "source_id", "target_id", "style"]),
    handler: edit_edge
  },
  {
    name: "list-layers",
    params: new Set([]),
    handler: list_layers
  },
  {
    name: "set-active-layer",
    params: new Set(["layer_id"]),
    handler: set_active_layer
  },
  {
    name: "move-cell-to-layer",
    params: new Set(["cell_id", "target_layer_id"]),
    handler: move_cell_to_layer
  },
  {
    name: "get-active-layer",
    params: new Set([]),
    handler: get_active_layer
  },
  {
    name: "create-layer",
    params: new Set(["name"]),
    handler: create_layer
  },
  {
    name: "export-diagram",
    params: new Set(["format", "scale", "border", "background", "shadow", "crop", "selection_only", "transparent", "dpi", "embed_xml", "size"]),
    handler: export_diagram
  },
  {
    name: "import-diagram",
    params: new Set(["data", "format", "mode", "filename"]),
    handler: import_diagram
  },
  {
    name: "import-mermaid",
    params: new Set(["mermaid_source", "mode", "insert_mode"]),
    handler: import_mermaid
  }
];

// Tool handlers map (will be populated on plugin load)
const toolHandlers = new Map<string, (request: any) => any>();

/**
 * Message handler for WebSocket messages from MCP server
 * Routes tool requests to appropriate handlers
 */
const handleWebSocketMessage = (message: any): void => {
  console.debug("[plugin] Received WebSocket message:", message);

  // Check if this is a tool request
  if (message.__event && toolHandlers.has(message.__event)) {
    const handler = toolHandlers.get(message.__event);
    if (handler) {
      handler(message);
    }
  }
};

/**
 * Initialize WebSocket connection
 */
const initializeWebSocket = (): void => {
  const config = readPluginConfig();
  const wsUrl = buildWebSocketUrl(config);

  wsManager = createWebSocketManager({
    url: wsUrl,
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,
    pingInterval: 30000,
  });

  wsManager.onMessage(handleWebSocketMessage);
  wsManager.connect();

  console.log(`[plugin] WebSocket initialized with URL: ${wsUrl}`);
};

/**
 * Initialize settings dialog
 */
const initializeSettingsDialog = (): void => {
  const config = readPluginConfig();
  const connectionState = wsManager ? wsManager.getState() : "disconnected";

  const initialState: SettingsDialogState = {
    config: { ...config },
    connectionState,
    isSaving: false,
    formData: {
      port: config.websocketPort.toString(),
    },
    errors: {},
  };

  const actions: SettingsDialogActions = {
    onSave: (newConfig) => {
      writePluginConfig(newConfig);

      // Reinitialize WebSocket with new config
      if (wsManager) {
        wsManager.disconnect();
      }
      initializeWebSocket();

      // Update dialog state
      if (settingsDialog) {
        settingsDialog.update({
          ...initialState,
          config: { ...newConfig },
          connectionState: wsManager ? wsManager.getState() : "disconnected",
          isSaving: false,
        });
      }

      console.log("[plugin] Configuration saved and WebSocket reinitialized");
    },

    onClose: () => {
      if (settingsDialog) {
        hideSettingsDialog(settingsDialog);
      }
    },

    onPing: async () => {
      if (wsManager) {
        return await wsManager.ping();
      }
      return false;
    },

    onReconnect: () => {
      if (wsManager) {
        wsManager.disconnect();
        wsManager.connect();
      }
    },
  };

  settingsDialog = createSettingsDialog(initialState, actions);
};

/**
 * Show settings dialog
 */
const showSettings = (): void => {
  if (!settingsDialog) {
    initializeSettingsDialog();
  }

  if (settingsDialog) {
    // Update connection state before showing
    const config = readPluginConfig();
    const connectionState = wsManager ? wsManager.getState() : "disconnected";

    settingsDialog.update({
      config: { ...config },
      connectionState,
      isSaving: false,
      formData: {
        port: config.websocketPort.toString(),
      },
      errors: {},
    });

    showSettingsDialog(settingsDialog);
  }
};

/**
 * Add MCP Settings menu item to Draw.io menu
 */
const addMenuItem = (ui: DrawioUI): void => {
  // Check if menubar is available
  if (!ui.menus) {
    console.warn("[plugin] Menu bar not available, cannot add MCP Settings menu item");
    return;
  }

  const menubar = ui.menus;

  try {
    // Try to find the extras menu first
    let targetMenu = menubar.get("extras") ||
      menubar.get("file") ||
      menubar.get("edit");

    if (!targetMenu) {
      console.warn("[plugin] Could not find suitable menu to add MCP Settings");
      return;
    }

    // Adds action
    ui.actions.addAction('Draw.io MCP', function () {
      showSettings();
    });

    var oldFunct = targetMenu.funct;

    targetMenu.funct = function (targetMenu: any, parent: any) {
      oldFunct.apply(this, arguments);

      ui.menus.addMenuItems(targetMenu, ['Draw.io MCP'], parent);
    };

  } catch (error) {
    console.error("[plugin] Failed to add menu item:", error);
  }
};

export default defineUnlistedScript(() => {
  console.debug("[plugin] Loading Draw.io MCP Plugin...");

  const checkInterval = setInterval(() => {
    if (window.Draw) {
      clearInterval(checkInterval);

      window.Draw.loadPlugin((drawioUI: DrawioUI) => {
        console.debug("[plugin] Plugin loaded successfully");
        ui = drawioUI;

        // Initialize tool handlers
        toolDefinitions.forEach(def => {
          const handler = createToolHandler(def.name, def.params, def.handler);
          toolHandlers.set(def.name, handler);
        });

        // Initialize WebSocket
        initializeWebSocket();

        // Initialize settings dialog
        initializeSettingsDialog();

        // Add menu item
        addMenuItem(ui);

        console.info("[plugin] MCP Plugin fully initialized");
      });
    }
  }, 1000);
});
