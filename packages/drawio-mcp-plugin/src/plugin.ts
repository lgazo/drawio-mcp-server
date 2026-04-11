/**
 * Draw.io MCP Plugin
 *
 * Main entry point for the plugin that runs inside Draw.io
 * Creates WebSocket connection and handles MCP tool requests
 */

import { setRuntimeCatalog } from "./shape-library";
import { extractShapesFromSidebar } from "./shape-extractor";

import {
  createWebSocketManager,
  type WebSocketManager,
} from "./websocketManager";
import {
  fetchPluginConfig,
  readPluginConfig,
  writePluginConfig,
  buildWebSocketUrl,
  type PluginConfig,
} from "./pluginConfig";
import {
  createSettingsDialog,
  showSettingsDialog,
  hideSettingsDialog,
  type SettingsDialogState,
  type SettingsDialogActions,
} from "./settingsDialog";
import { remove_circular_dependencies } from "./drawio-tools";
import { toolDefinitions } from "./tool-registry";
import { type DrawioUI } from "./types";

function reply_name(event_name: string, request_id: string) {
  return `${event_name}.${request_id}`;
}

const createToolHandler = (
  toolName: string,
  parameterKeys: Set<string>,
  executeFunction: (ui: DrawioUI, options: Record<string, unknown>) => unknown,
) => {
  return (request: any): any => {
    const optionEntries = Object.entries(request).filter(([key, _value]) => {
      return parameterKeys.has(key);
    });

    const options = optionEntries.reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, unknown>,
    );

    const sendReply = (result: any, success: boolean, error?: any) => {
      const reply = {
        __event: reply_name(toolName, request.__request_id),
        __request_id: request.__request_id,
        success,
        result: success ? remove_circular_dependencies(result) : undefined,
        error: !success ? remove_circular_dependencies(error) : undefined,
      };
      if (wsManager) {
        wsManager.send(reply);
      }
      return reply;
    };

    try {
      const result = executeFunction(ui, options);
      if (result instanceof Promise) {
        result.then(
          (resolved) => sendReply(resolved, true),
          (err) => {
            console.error(
              `[plugin] Tool ${toolName} failed for request ID ${request.__request_id}:`,
              err,
            );
            sendReply(undefined, false, err);
          },
        );
        return undefined;
      }
      return sendReply(result, true);
    } catch (error) {
      console.error(
        `[plugin] Tool ${toolName} failed for request ID ${request.__request_id}:`,
        error,
      );
      return sendReply(undefined, false, error);
    }
  };
};

let ui: DrawioUI;
let wsManager: WebSocketManager | null = null;
let settingsDialog: {
  element: HTMLElement;
  update: (state: SettingsDialogState) => void;
} | null = null;

const toolHandlers = new Map<string, (request: any) => any>();

const handleWebSocketMessage = (message: any): void => {
  console.debug("[plugin] Received WebSocket message:", message);

  if (message.__event && toolHandlers.has(message.__event)) {
    const handler = toolHandlers.get(message.__event);
    if (handler) {
      handler(message);
    }
  }
};

const initializeWebSocket = async (): Promise<void> => {
  const config = await fetchPluginConfig();
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

      if (wsManager) {
        wsManager.disconnect();
      }
      initializeWebSocket();

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

const showSettings = (): void => {
  if (!settingsDialog) {
    initializeSettingsDialog();
  }

  if (settingsDialog) {
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

const addMenuItem = (ui: DrawioUI): void => {
  if (!ui.menus) {
    console.warn(
      "[plugin] Menu bar not available, cannot add MCP Settings menu item",
    );
    return;
  }

  const menubar = ui.menus;

  try {
    let targetMenu =
      menubar.get("extras") || menubar.get("file") || menubar.get("edit");

    if (!targetMenu) {
      console.warn("[plugin] Could not find suitable menu to add MCP Settings");
      return;
    }

    ui.actions.addAction("Draw.io MCP", function () {
      showSettings();
    });

    var oldFunct = targetMenu.funct;

    targetMenu.funct = function (targetMenu: any, parent: any) {
      oldFunct.apply(this, arguments);

      ui.menus.addMenuItems(targetMenu, ["Draw.io MCP"], parent);
    };
  } catch (error) {
    console.error("[plugin] Failed to add menu item:", error);
  }
};

function tryExtractShapes(): boolean {
  try {
    if (!ui?.sidebar) return false;
    const map = extractShapesFromSidebar(ui);
    if (map.size === 0) return false;
    const runtime = new Map(
      [...map].map(
        ([k, v]) =>
          [k, { style: v.style, category: v.category, name: v.name }] as const,
      ),
    );
    setRuntimeCatalog(runtime);
    console.info(
      `[plugin] extracted ${map.size} vendor shapes from drawio sidebar`,
    );
    return true;
  } catch (err) {
    console.warn("[plugin] shape extraction attempt failed", err);
    return false;
  }
}

function scheduleShapeExtraction(): void {
  if (tryExtractShapes()) return;
  let attempts = 0;
  const maxAttempts = 10;
  const interval = setInterval(() => {
    attempts += 1;
    if (tryExtractShapes() || attempts >= maxAttempts) {
      clearInterval(interval);
      if (attempts >= maxAttempts) {
        console.error(
          "[plugin] shape extraction gave up after retries; vendor shapes unavailable",
        );
      }
    }
  }, 1000);
}

function initPlugin() {
  console.debug("[plugin] Loading Draw.io MCP Plugin...");

  const checkInterval = setInterval(() => {
    if (window.Draw) {
      clearInterval(checkInterval);

      window.Draw.loadPlugin((drawioUI: DrawioUI) => {
        console.debug("[plugin] Plugin loaded successfully");
        ui = drawioUI;

        if ((window as any).__DRAWIO_MCP_TEST_HOOKS__ === true) {
          (window as any).ui = drawioUI;
        }

        toolDefinitions.forEach((def) => {
          const handler = createToolHandler(def.name, def.params, def.handler);
          toolHandlers.set(def.name, handler);
        });

        initializeWebSocket();

        initializeSettingsDialog();

        addMenuItem(ui);

        scheduleShapeExtraction();

        console.info("[plugin] MCP Plugin fully initialized");
      });
    }
  }, 1000);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlugin);
  } else {
    initPlugin();
  }
}
