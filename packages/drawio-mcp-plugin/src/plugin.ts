/**
 * Draw.io MCP Plugin
 *
 * Main entry point for the bundled plugin (mcp-plugin.js) that ships
 * inside Draw.io. Responsible only for the host-specific concerns:
 * WebSocket transport, settings dialog, and menu wiring. The runtime
 * tool dispatch and document-state plumbing live in `bootstrapPlugin`.
 */

import { bootstrapPlugin, type Transport } from "./bootstrap";
import {
  createWebSocketManager,
  type WebSocketManager,
} from "./websocketManager";
import {
  fetchPluginConfig,
  readPluginConfig,
  writePluginConfig,
  buildWebSocketUrl,
} from "./pluginConfig";
import {
  createSettingsDialog,
  showSettingsDialog,
  hideSettingsDialog,
  type SettingsDialogState,
  type SettingsDialogActions,
} from "./settingsDialog";
import { type DrawioUI } from "./types";

let ui: DrawioUI;
let wsManager: WebSocketManager | null = null;
let bootstrapListener: ((message: any) => void) | null = null;
let settingsDialog: {
  element: HTMLElement;
  update: (state: SettingsDialogState) => void;
} | null = null;

const transport: Transport = {
  send: (message) => wsManager?.send(message),
  onMessage: (listener) => {
    bootstrapListener = listener;
    wsManager?.onMessage(listener);
  },
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

  if (bootstrapListener) {
    wsManager.onMessage(bootstrapListener);
  }
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
      url: config.websocketUrl ?? "",
    },
    errors: {},
  };

  const actions: SettingsDialogActions = {
    onSave: (newConfig) => {
      writePluginConfig(newConfig);

      if (wsManager) {
        wsManager.disconnect();
      }
      void initializeWebSocket();

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
        url: config.websocketUrl ?? "",
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

        bootstrapPlugin({ ui, transport });

        void initializeWebSocket();

        initializeSettingsDialog();
        addMenuItem(ui);

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
