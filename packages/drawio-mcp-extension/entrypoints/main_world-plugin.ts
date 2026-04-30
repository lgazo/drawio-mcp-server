import {
  bootstrapPlugin,
  buildWebSocketUrl,
  createSettingsDialog,
  createWebSocketManager,
  hideSettingsDialog,
  readPluginConfig,
  showSettingsDialog,
  writePluginConfig,
  type PluginConfig,
  type SettingsDialogActions,
  type SettingsDialogState,
  type Transport,
  type WebSocketManager,
} from "drawio-mcp-plugin";
import { DrawioUI } from "../types";

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

const initializeWebSocket = (): void => {
  const config = readPluginConfig();
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
      port: config.websocketPort.toString(),
    },
    errors: {},
  };

  const actions: SettingsDialogActions = {
    onSave: (newConfig: PluginConfig) => {
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

export default defineUnlistedScript(() => {
  console.debug("[plugin] Loading Draw.io MCP Plugin...");

  const checkInterval = setInterval(() => {
    if (window.Draw) {
      clearInterval(checkInterval);

      window.Draw.loadPlugin((drawioUI: DrawioUI) => {
        console.debug("[plugin] Plugin loaded successfully");
        ui = drawioUI;

        bootstrapPlugin({ ui, transport });

        initializeWebSocket();

        initializeSettingsDialog();

        addMenuItem(ui);

        console.info("[plugin] MCP Plugin fully initialized");
      });
    }
  }, 1000);
});
