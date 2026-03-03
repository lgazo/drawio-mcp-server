import { initializeContentScripts, updateContentScriptRegistration } from '@/contentScript';
import { getWebSocketUrl, CONFIG_STORAGE_KEY } from '../config';

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  // Track current connection state
  let currentConnectionState: "connected" | "connecting" | "disconnected" =
    "disconnected";

  // Set initial icon state
  setExtensionIcon("disconnected");

  // Function to set extension icon based on connection state
  function setExtensionIcon(
    state: "connected" | "connecting" | "disconnected",
  ) {
    // Update current connection state
    currentConnectionState = state;

    const iconSizes = [16, 32, 48, 128];
    const iconPaths = iconSizes.reduce(
      (acc, size) => ({
        ...acc,
        [size]: `/icon/logo_${state}_${size}.png`,
      }),
      {},
    );

    const browserAction = browser.browserAction
      ? browser.browserAction
      : browser.action;
    browserAction.setIcon({ path: iconPaths });

    // Broadcast connection state update to any open popups
    browser.runtime
      .sendMessage({
        type: "CONNECTION_STATE_UPDATE",
        state: currentConnectionState,
      })
      .catch(() => {
        // Ignore errors (no popup listening)
      });
  }

  // Function to establish WebSocket connection
  async function connect() {
    setExtensionIcon("connecting");

    try {
      const wsUrl = await getWebSocketUrl();
      socket = new WebSocket(wsUrl);

      socket.addEventListener("open", (event) => {
        console.debug("[background] WebSocket connection established", event);
        reconnectAttempts = 0; // Reset reconnect counter on successful connection
        setExtensionIcon("connected");
        // Notify content scripts that connection is ready
        broadcastToContentScripts({ type: "WS_STATUS", connected: true });
      });

      socket.addEventListener("message", (event) => {
        console.debug("[background] Message from server:", event.data);
        const json = JSON.parse(event.data);
        // Forward messages to all content scripts
        broadcastToContentScripts({
          type: "WS_MESSAGE",
          data: json,
        });
      });

      socket.addEventListener("close", (event) => {
        console.debug("[background] WebSocket connection closed", event);
        setExtensionIcon("disconnected");
        broadcastToContentScripts({ type: "WS_STATUS", connected: false });
        attemptReconnect();
      });

      socket.addEventListener("error", (event) => {
        console.error("[background] WebSocket error:", event);
        setExtensionIcon("disconnected");
      });
    } catch (error) {
      console.error("[background] Failed to get WebSocket URL:", error);
      setExtensionIcon("disconnected");
    }
  }

  // Reconnection logic with exponential backoff
  function attemptReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts);
      setExtensionIcon("connecting");
      console.log(
        `Attempting to reconnect in ${delay / 1000} seconds... (attempt ${reconnectAttempts})`,
      );

      setTimeout(() => {
        connect();
      }, delay);
    } else {
      console.error("Max reconnection attempts reached. Giving up.");
      setExtensionIcon("disconnected");
    }
  }

  // Function to broadcast messages to all content scripts
  async function broadcastToContentScripts(message: any) {
    const tabs = await browser.tabs.query({});
    console.debug(`[background] broadcast to tabs`, tabs);
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, message).catch((err) => {
          // Ignore errors (tabs without content script)
        });
      }
    }
  }

  // Handle messages from content scripts and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle messages from content scripts
    if (
      message.type === "SEND_WS_MESSAGE" &&
      socket?.readyState === WebSocket.OPEN
    ) {
      const ser = JSON.stringify(message.data);
      console.debug(`[background] received from content`, {
        received: message.data,
        sending: ser,
      });
      socket.send(ser);
    }

    // Handle connection state request from popup
    if (message.type === "GET_CONNECTION_STATE") {
      console.debug("[background] Connection state requested by popup");
      sendResponse({ state: currentConnectionState });
    }

    // Handle ping request from popup
    if (
      message.type === "SEND_PING_TO_SERVER" &&
      socket?.readyState === WebSocket.OPEN
    ) {
      console.debug("[background] Ping requested by popup");
      socket.send(
        JSON.stringify({ type: "PING", message: "Ping from extension popup" }),
      );
      sendResponse({ success: true });
    }

    // Handle reconnect request from popup
    if (message.type === "RECONNECT_TO_SERVER") {
      console.debug("[background] Reconnection requested by popup");

      // Close existing socket if it exists
      if (socket) {
        socket.close();
        socket = null;
      }

      // Reset reconnect attempts to start fresh
      reconnectAttempts = 0;

      // Initiate connection
      connect();

      sendResponse({ success: true });
    }

    return true; // Keep the message channel open for async response
  });

  // Listen for storage changes to auto-reconnect and update content scripts when config changes
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync' || areaName === 'local') {
      if (changes[CONFIG_STORAGE_KEY]) {
        console.debug("[background] Configuration changed, updating WebSocket and content scripts...");

        // Update content script registration first
        try {
          const newConfig = changes[CONFIG_STORAGE_KEY].newValue;
          if (newConfig && newConfig.urlPatterns) {
            await updateContentScriptRegistration(newConfig);
          }
        } catch (error) {
          connect();
        }
      }
    }
  });

  // Initial connection
  connect();

  // Initialize content scripts
  initializeContentScripts();

  // Optional: Keepalive ping
  const keepAliveInterval = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
    } else {
      console.debug(
        `[background] keep alive skipped for state ${socket?.readyState}`,
      );
    }
  }, 30000); // Every 30 seconds

  // Cleanup on extension unload
  browser.runtime.onSuspend.addListener(() => {
    clearInterval(keepAliveInterval);
    if (socket) {
      socket.close();
    }
  });
});
