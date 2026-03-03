/**
 * Settings Dialog Module
 *
 * Composition-based UI for WebSocket settings
 * Creates plain DOM modal dialog for Draw.io integration
 */

import type { WebSocketManager } from "./websocketManager";
import type { PluginConfig } from "./pluginConfig";

// Dialog state interface
export interface SettingsDialogState {
  config: PluginConfig;
  connectionState: "connecting" | "connected" | "disconnected";
  isSaving: boolean;
  formData: {
    port: string;
  };
  errors: {
    port?: string;
  };
}

// Message types for dialog communication
export type SettingsMessage =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "UPDATE_CONFIG"; config: PluginConfig }
  | { type: "UPDATE_CONNECTION_STATE"; state: "connecting" | "connected" | "disconnected" }
  | { type: "UPDATE_PORT"; port: string }
  | { type: "SAVE" }
  | { type: "RESET" };

// Dialog actions
export interface SettingsDialogActions {
  onSave: (config: PluginConfig) => void;
  onClose: () => void;
  onPing: () => Promise<boolean>;
  onReconnect: () => void;
}

/**
 * Create the main dialog container
 */
function createDialogContainer(): HTMLElement {
  const container = document.createElement("div");
  container.id = "mcp-settings-dialog";
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Prevent clicks on overlay from closing dialog
  container.addEventListener("click", (e) => {
    if (e.target === container) {
      e.stopPropagation();
    }
  });

  return container;
}

/**
 * Create the dialog content box
 */
function createDialogContent(): HTMLElement {
  const content = document.createElement("div");
  content.className = "dialog-content";
  content.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  `;

  return content;
}

/**
 * Create dialog header
 */
function createDialogHeader(title: string, onClose: () => void): HTMLElement {
  const header = document.createElement("div");
  header.className = "dialog-header";
  header.style.cssText = `
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const titleEl = document.createElement("h2");
  titleEl.textContent = title;
  titleEl.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
  `;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    border-radius: 4px;
  `;
  closeBtn.title = "Close";
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.backgroundColor = "#f5f5f5";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.backgroundColor = "transparent";
  });
  closeBtn.addEventListener("click", onClose);

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  return header;
}

/**
 * Create dialog body
 */
function createDialogBody(state: SettingsDialogState, actions: SettingsDialogActions): HTMLElement {
  const body = document.createElement("div");
  body.className = "dialog-body";
  body.style.cssText = `
    padding: 20px;
  `;

  // Connection status section
  const statusSection = createStatusSection(state);
  body.appendChild(statusSection);

  // Form section
  const formSection = createFormSection(state, actions);
  body.appendChild(formSection);

  return body;
}

/**
 * Create connection status display
 */
function createStatusSection(state: SettingsDialogState): HTMLElement {
  const section = document.createElement("div");
  section.className = "status-section";
  section.style.cssText = `
    margin-bottom: 24px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  `;

  const title = document.createElement("div");
  title.style.cssText = `
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
  `;
  title.textContent = "Connection Status";

  const statusIndicator = document.createElement("div");
  statusIndicator.className = "status-indicator";
  statusIndicator.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  `;

  const indicator = document.createElement("div");
  indicator.style.cssText = `
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  `;

  // Set indicator color based on state
  switch (state.connectionState) {
    case "connected":
      indicator.style.backgroundColor = "#28a745";
      break;
    case "connecting":
      indicator.style.backgroundColor = "#ffc107";
      break;
    case "disconnected":
      indicator.style.backgroundColor = "#dc3545";
      break;
  }

  const statusText = document.createElement("span");
  statusText.textContent = state.connectionState.charAt(0).toUpperCase() + state.connectionState.slice(1);
  statusText.style.fontWeight = "500";

  statusIndicator.appendChild(indicator);
  statusIndicator.appendChild(statusText);

  const portDisplay = document.createElement("div");
  portDisplay.style.cssText = `
    font-size: 14px;
    color: #666;
  `;
  portDisplay.textContent = `Port: ${state.config.websocketPort}`;

  section.appendChild(title);
  section.appendChild(statusIndicator);
  section.appendChild(portDisplay);

  return section;
}

/**
 * Create form section with port input
 */
function createFormSection(state: SettingsDialogState, actions: SettingsDialogActions): HTMLElement {
  const section = document.createElement("div");
  section.className = "form-section";

  // Port input group
  const portGroup = document.createElement("div");
  portGroup.className = "form-group";
  portGroup.style.cssText = `
    margin-bottom: 16px;
  `;

  const label = document.createElement("label");
  label.textContent = "WebSocket Port";
  label.htmlFor = "mcp-port-input";
  label.style.cssText = `
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
  `;

  const input = document.createElement("input");
  input.id = "mcp-port-input";
  input.type = "number";
  input.min = "1024";
  input.max = "65535";
  input.value = state.formData.port;
  input.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  `;

  if (state.errors.port) {
    input.style.borderColor = "#dc3545";
  }

  input.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    window.dispatchEvent(new CustomEvent("mcp-settings-message", {
      detail: { type: "UPDATE_PORT", port: value }
    }));
  });

  const hint = document.createElement("div");
  hint.textContent = "Port must be between 1024 and 65535";
  hint.style.cssText = `
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  `;

  if (state.errors.port) {
    const error = document.createElement("div");
    error.textContent = state.errors.port;
    error.style.cssText = `
      font-size: 12px;
      color: #dc3545;
      margin-top: 4px;
    `;
    portGroup.appendChild(error);
  }

  portGroup.appendChild(label);
  portGroup.appendChild(input);
  portGroup.appendChild(hint);

  section.appendChild(portGroup);

  return section;
}

/**
 * Create dialog footer with buttons
 */
function createDialogFooter(state: SettingsDialogState, actions: SettingsDialogActions): HTMLElement {
  const footer = document.createElement("div");
  footer.className = "dialog-footer";
  footer.style.cssText = `
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `;

  // Left side actions
  const leftActions = document.createElement("div");
  leftActions.style.cssText = `
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `;

  // Right side actions
  const rightActions = document.createElement("div");
  rightActions.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  const cancelBtn = createButton("Cancel", "ghost", () => {
    window.dispatchEvent(new CustomEvent("mcp-settings-message", {
      detail: { type: "CLOSE" }
    }));
  });

  const saveBtn = createButton(
    state.isSaving ? "Saving..." : "Save",
    "primary",
    () => {
      window.dispatchEvent(new CustomEvent("mcp-settings-message", {
        detail: { type: "SAVE" }
      }));
    },
    state.isSaving
  );

  rightActions.appendChild(cancelBtn);
  rightActions.appendChild(saveBtn);

  footer.appendChild(leftActions);
  footer.appendChild(rightActions);

  return footer;
}

/**
 * Create styled button
 */
function createButton(text: string, variant: "primary" | "secondary" | "ghost", onClick: () => void, disabled = false): HTMLElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.disabled = disabled;
  btn.style.cssText = `
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
  `;

  switch (variant) {
    case "primary":
      btn.style.cssText += `
        background-color: #007bff;
        color: white;
        border-color: #007bff;
      `;
      btn.addEventListener("mouseenter", () => {
        if (!disabled) btn.style.backgroundColor = "#0056b3";
      });
      btn.addEventListener("mouseleave", () => {
        if (!disabled) btn.style.backgroundColor = "#007bff";
      });
      break;
    case "secondary":
      btn.style.cssText += `
        background-color: #6c757d;
        color: white;
        border-color: #6c757d;
      `;
      btn.addEventListener("mouseenter", () => {
        if (!disabled) btn.style.backgroundColor = "#545b62";
      });
      btn.addEventListener("mouseleave", () => {
        if (!disabled) btn.style.backgroundColor = "#6c757d";
      });
      break;
    case "ghost":
      btn.style.cssText += `
        background-color: transparent;
        color: #6c757d;
        border-color: #6c757d;
      `;
      btn.addEventListener("mouseenter", () => {
        if (!disabled) {
          btn.style.backgroundColor = "#f8f9fa";
        }
      });
      btn.addEventListener("mouseleave", () => {
        if (!disabled) btn.style.backgroundColor = "transparent";
      });
      break;
  }

  if (disabled) {
    btn.style.cssText += `
      opacity: 0.6;
      cursor: not-allowed;
    `;
  }

  btn.addEventListener("click", onClick);

  return btn;
}

/**
 * Compose the complete dialog
 */
export function createSettingsDialog(
  initialState: SettingsDialogState,
  actions: SettingsDialogActions
): { element: HTMLElement; update: (state: SettingsDialogState) => void } {
  let currentState = { ...initialState };
  let dialogElement: HTMLElement | null = null;
  let isVisible = false;

  /**
   * Update dialog state and refresh UI
   */
  const update = (newState: SettingsDialogState): void => {
    currentState = { ...newState };
    // Only re-render if the dialog is currently visible
    if (dialogElement && isVisible) {
      render();
    }
  };

  /**
   * Render or re-render the dialog
   */
  const render = (): HTMLElement => {
    // Remove existing dialog
    if (dialogElement && dialogElement.parentNode) {
      dialogElement.parentNode.removeChild(dialogElement);
    }

    // Create new dialog structure
    const container = createDialogContainer();
    const content = createDialogContent();

    const header = createDialogHeader("MCP Settings", () => actions.onClose());
    const body = createDialogBody(currentState, actions);
    const footer = createDialogFooter(currentState, actions);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    container.appendChild(content);

    dialogElement = container;
    isVisible = true;

    // Set up message listeners
    setupMessageListeners(container, actions);

    return container;
  };

  /**
   * Set up event listeners for dialog communication
   */
  const setupMessageListeners = (container: HTMLElement, actions: SettingsDialogActions): void => {
    const handleMessage = (event: CustomEvent<SettingsMessage>) => {
      const message = event.detail;

      switch (message.type) {
        case "UPDATE_PORT":
          // Update form data WITHOUT re-rendering
          currentState.formData.port = message.port;
          // Clear port error
          delete currentState.errors.port;
          // Don't call update() to avoid re-rendering the dialog
          break;

        case "SAVE":
          // Validate and save
          if (!validateAndSave()) {
            update(currentState);
          }
          break;

        case "CLOSE":
          actions.onClose();
          break;
      }
    };

    window.addEventListener("mcp-settings-message", handleMessage as EventListener);

    // Clean up on dialog removal
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === container) {
            window.removeEventListener("mcp-settings-message", handleMessage as EventListener);
            observer.disconnect();
          }
        });
      });
    });

    if (container.parentNode) {
      observer.observe(container.parentNode, { childList: true });
    }
  };

  /**
   * Validate form and trigger save
   */
  const validateAndSave = (): boolean => {
    const portNum = parseInt(currentState.formData.port, 10);

    if (isNaN(portNum)) {
      currentState.errors.port = "Port must be a number";
      return false;
    }

    if (portNum < 1024 || portNum > 65535) {
      currentState.errors.port = "Port must be between 1024 and 65535";
      return false;
    }

    // Clear errors and save
    currentState.errors = {};
    currentState.isSaving = true;

    const newConfig: PluginConfig = {
      websocketPort: portNum,
    };

    actions.onSave(newConfig);

    return true;
  };

  // Create a proxy object that always returns the current dialog element
  const dialogProxy = {
    get element(): HTMLElement {
      if (!dialogElement) {
        render();
      }
      return dialogElement!;
    },
    update,
  };

  return dialogProxy;
}

/**
 * Show the dialog
 */
export function showSettingsDialog(dialog: { element: HTMLElement }): void {
  // The dialog.element getter will ensure we get the current rendered element
  if (!dialog.element.parentNode) {
    document.body.appendChild(dialog.element);
  }
}

/**
 * Hide the dialog
 */
export function hideSettingsDialog(dialog: { element: HTMLElement }): void {
  if (dialog.element.parentNode) {
    dialog.element.parentNode.removeChild(dialog.element);
  }
}
