/**
 * Settings Dialog Module
 *
 * Composition-based UI for WebSocket settings
 * Creates plain DOM modal dialog for Draw.io integration
 */

import {
  buildWebSocketUrl,
  isValidWebSocketUrl,
  type PluginConfig,
} from "./pluginConfig";

export interface SettingsDialogState {
  config: PluginConfig;
  connectionState: "connecting" | "connected" | "disconnected";
  isSaving: boolean;
  formData: {
    url: string;
  };
  errors: {
    url?: string;
  };
}

export type SettingsMessage =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "UPDATE_CONFIG"; config: PluginConfig }
  | {
      type: "UPDATE_CONNECTION_STATE";
      state: "connecting" | "connected" | "disconnected";
    }
  | { type: "UPDATE_URL"; url: string }
  | { type: "SAVE" }
  | { type: "RESET" };

export interface SettingsDialogActions {
  onSave: (config: PluginConfig) => void;
  onClose: () => void;
  onPing: () => Promise<boolean>;
  onReconnect: () => void;
}

function defaultUrlFor(config: PluginConfig): string {
  return buildWebSocketUrl({ ...config, websocketUrl: undefined });
}

function effectiveUrlFor(config: PluginConfig): string {
  return buildWebSocketUrl(config);
}

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

  container.addEventListener("click", (e) => {
    if (e.target === container) {
      e.stopPropagation();
    }
  });

  return container;
}

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

function createDialogBody(state: SettingsDialogState): HTMLElement {
  const body = document.createElement("div");
  body.className = "dialog-body";
  body.style.cssText = `
    padding: 20px;
  `;

  const statusSection = createStatusSection(state);
  body.appendChild(statusSection);

  const formSection = createFormSection(state);
  body.appendChild(formSection);

  return body;
}

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
  statusText.textContent =
    state.connectionState.charAt(0).toUpperCase() +
    state.connectionState.slice(1);
  statusText.style.fontWeight = "500";

  statusIndicator.appendChild(indicator);
  statusIndicator.appendChild(statusText);

  const urlDisplay = document.createElement("div");
  urlDisplay.style.cssText = `
    font-size: 14px;
    color: #666;
    word-break: break-all;
  `;
  urlDisplay.textContent = `URL: ${effectiveUrlFor(state.config)}`;

  section.appendChild(title);
  section.appendChild(statusIndicator);
  section.appendChild(urlDisplay);

  return section;
}

function createFormSection(state: SettingsDialogState): HTMLElement {
  const section = document.createElement("div");
  section.className = "form-section";

  const urlGroup = document.createElement("div");
  urlGroup.className = "form-group";
  urlGroup.style.cssText = `
    margin-bottom: 16px;
  `;

  const label = document.createElement("label");
  label.textContent = "WebSocket URL";
  label.htmlFor = "mcp-url-input";
  label.style.cssText = `
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
  `;

  const input = document.createElement("input");
  input.id = "mcp-url-input";
  input.type = "text";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.value = state.formData.url;
  input.placeholder = defaultUrlFor(state.config);
  input.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    box-sizing: border-box;
  `;

  if (state.errors.url) {
    input.style.borderColor = "#dc3545";
  }

  input.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    window.dispatchEvent(
      new CustomEvent("mcp-settings-message", {
        detail: { type: "UPDATE_URL", url: value },
      }),
    );
  });

  const hint = document.createElement("div");
  hint.textContent = `Leave blank to use the default (${defaultUrlFor(state.config)}). Must start with ws:// or wss://`;
  hint.style.cssText = `
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    word-break: break-all;
  `;

  urlGroup.appendChild(label);
  urlGroup.appendChild(input);
  urlGroup.appendChild(hint);

  if (state.errors.url) {
    const error = document.createElement("div");
    error.textContent = state.errors.url;
    error.style.cssText = `
      font-size: 12px;
      color: #dc3545;
      margin-top: 4px;
    `;
    urlGroup.appendChild(error);
  }

  section.appendChild(urlGroup);

  return section;
}

function createDialogFooter(state: SettingsDialogState): HTMLElement {
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

  const leftActions = document.createElement("div");
  leftActions.style.cssText = `
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `;

  const rightActions = document.createElement("div");
  rightActions.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  const cancelBtn = createButton("Cancel", "ghost", () => {
    window.dispatchEvent(
      new CustomEvent("mcp-settings-message", {
        detail: { type: "CLOSE" },
      }),
    );
  });

  const saveBtn = createButton(
    state.isSaving ? "Saving..." : "Save",
    "primary",
    () => {
      window.dispatchEvent(
        new CustomEvent("mcp-settings-message", {
          detail: { type: "SAVE" },
        }),
      );
    },
    state.isSaving,
  );

  rightActions.appendChild(cancelBtn);
  rightActions.appendChild(saveBtn);

  footer.appendChild(leftActions);
  footer.appendChild(rightActions);

  return footer;
}

function createButton(
  text: string,
  variant: "primary" | "secondary" | "ghost",
  onClick: () => void,
  disabled = false,
): HTMLElement {
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

export function createSettingsDialog(
  initialState: SettingsDialogState,
  actions: SettingsDialogActions,
): { element: HTMLElement; update: (state: SettingsDialogState) => void } {
  let currentState = { ...initialState };
  let dialogElement: HTMLElement | null = null;
  let isVisible = false;

  const update = (newState: SettingsDialogState): void => {
    currentState = { ...newState };
    if (dialogElement && isVisible) {
      render();
    }
  };

  const render = (): HTMLElement => {
    if (dialogElement && dialogElement.parentNode) {
      dialogElement.parentNode.removeChild(dialogElement);
    }

    const container = createDialogContainer();
    const content = createDialogContent();

    const header = createDialogHeader("MCP Settings", () => actions.onClose());
    const body = createDialogBody(currentState);
    const footer = createDialogFooter(currentState);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    container.appendChild(content);

    dialogElement = container;
    isVisible = true;

    setupMessageListeners(container, actions);

    return container;
  };

  const setupMessageListeners = (
    container: HTMLElement,
    actions: SettingsDialogActions,
  ): void => {
    const handleMessage = (event: CustomEvent<SettingsMessage>) => {
      const message = event.detail;

      switch (message.type) {
        case "UPDATE_URL":
          currentState.formData.url = message.url;
          delete currentState.errors.url;
          break;

        case "SAVE":
          if (!validateAndSave()) {
            update(currentState);
          }
          break;

        case "CLOSE":
          actions.onClose();
          break;
      }
    };

    window.addEventListener(
      "mcp-settings-message",
      handleMessage as EventListener,
    );

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === container) {
            window.removeEventListener(
              "mcp-settings-message",
              handleMessage as EventListener,
            );
            observer.disconnect();
          }
        });
      });
    });

    if (container.parentNode) {
      observer.observe(container.parentNode, { childList: true });
    }
  };

  const validateAndSave = (): boolean => {
    const trimmed = currentState.formData.url.trim();

    if (trimmed.length > 0 && !isValidWebSocketUrl(trimmed)) {
      currentState.errors.url = "URL must start with ws:// or wss://";
      return false;
    }

    currentState.errors = {};
    currentState.isSaving = true;

    const newConfig: PluginConfig = {
      ...currentState.config,
      websocketUrl: trimmed.length > 0 ? trimmed : undefined,
    };

    actions.onSave(newConfig);

    return true;
  };

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

export function showSettingsDialog(dialog: { element: HTMLElement }): void {
  if (!dialog.element.parentNode) {
    document.body.appendChild(dialog.element);
  }
}

export function hideSettingsDialog(dialog: { element: HTMLElement }): void {
  if (dialog.element.parentNode) {
    dialog.element.parentNode.removeChild(dialog.element);
  }
}
