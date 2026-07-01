import { initializeContentScripts, updateContentScriptRegistration } from '@/contentScript';
import { getWebSocketUrl, CONFIG_STORAGE_KEY, type ExtensionConfig } from '../config';

const CONTENT_PORT_NAME = "drawio-mcp-frame";

type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  // Track current connection state
  let currentConnectionState: "connected" | "connecting" | "disconnected" =
    "disconnected";

  // Track current compat state
  let currentCompatState: CompatState = { kind: "unknown" };

  type ContentPort = ReturnType<typeof browser.runtime.connect>;

  // Ports opened by content scripts. One per frame (top frame + any iframes).
  const contentPorts = new Set<ContentPort>();

  // Every drawio document.id observed on a port's outbound `document-state`
  // is remembered here so inbound tool calls with `target_document.id` can be
  // routed to exactly the port whose plugin owns the document. Without this,
  // background would broadcast every tool call to every drawio tab and the
  // tabs whose id doesn't match would throw "no longer active" errors.
  const portToDocuments = new Map<ContentPort, Set<string>>();
  const documentToPort = new Map<string, ContentPort>();

  function forgetPortDocuments(port: ContentPort) {
    const owned = portToDocuments.get(port);
    if (!owned) return [] as string[];
    portToDocuments.delete(port);
    const removed: string[] = [];
    for (const documentId of owned) {
      if (documentToPort.get(documentId) === port) {
        documentToPort.delete(documentId);
        removed.push(documentId);
      }
    }
    return removed;
  }

  function rememberDocumentForPort(port: ContentPort, documentId: string) {
    const previousPort = documentToPort.get(documentId);
    if (previousPort && previousPort !== port) {
      portToDocuments.get(previousPort)?.delete(documentId);
    }
    documentToPort.set(documentId, port);
    let owned = portToDocuments.get(port);
    if (!owned) {
      owned = new Set();
      portToDocuments.set(port, owned);
    }
    owned.add(documentId);
  }

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== CONTENT_PORT_NAME) return;
    contentPorts.add(port);
    console.debug(
      `[background] content port connected (total=${contentPorts.size})`,
      port.sender?.tab?.id,
      port.sender?.frameId,
    );
    // Send current WS status to the new frame immediately.
    try {
      port.postMessage({
        type: "WS_STATUS",
        connected: currentConnectionState === "connected",
      });
    } catch (err) {
      console.debug("[background] initial WS_STATUS post failed", err);
    }
    port.onMessage.addListener((message: any) => {
      if (message?.type === "SEND_WS_MESSAGE") {
        handleContentSend(port, message.data);
      }
    });
    port.onDisconnect.addListener(() => {
      contentPorts.delete(port);
      const removed = forgetPortDocuments(port);
      for (const documentId of removed) {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              __control: "document-removed",
              document_id: documentId,
            }),
          );
        }
      }
      console.debug(
        `[background] content port disconnected (total=${contentPorts.size})`,
      );
    });
  });

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

  // Derive and broadcast compat state
  function updateCompatState(next: CompatState) {
    currentCompatState = next;
    browser.runtime
      .sendMessage({ type: "COMPAT_STATE_UPDATE", state: next })
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
        dispatchServerMessage(json);
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

  // Broadcast to every frame whose content script holds an open port.
  // Unlike browser.tabs.sendMessage (which targets only the top frame by
  // default), this reaches iframes too when allFrames injection is enabled.
  function broadcastToContentScripts(message: any) {
    console.debug(
      `[background] broadcast to ${contentPorts.size} content port(s)`,
    );
    for (const port of contentPorts) {
      try {
        port.postMessage(message);
      } catch (err) {
        console.debug("[background] dropping dead port", err);
        contentPorts.delete(port);
        forgetPortDocuments(port);
      }
    }
  }

  function postToPort(port: ContentPort, message: any) {
    try {
      port.postMessage(message);
    } catch (err) {
      console.debug("[background] dropping dead port", err);
      contentPorts.delete(port);
      forgetPortDocuments(port);
    }
  }

  // Dispatch a WS_MESSAGE from the server to content scripts. Tool calls
  // carry `target_document.id`; route them to the single port whose plugin
  // owns that document, so other tabs' plugins never see the request and
  // can't race to reply first. Control messages (no target_document) still
  // broadcast — every frame needs to see e.g. sync-document-state.
  function dispatchServerMessage(payload: any) {
    const targetDocumentId =
      typeof payload?.target_document?.id === "string"
        ? payload.target_document.id
        : null;
    if (targetDocumentId) {
      const port = documentToPort.get(targetDocumentId);
      if (port) {
        console.debug(
          `[background] routing to port for document ${targetDocumentId}`,
        );
        postToPort(port, { type: "WS_MESSAGE", data: payload });
        return;
      }
      console.debug(
        `[background] no port owns document ${targetDocumentId}; falling back to broadcast`,
      );
    }
    broadcastToContentScripts({ type: "WS_MESSAGE", data: payload });
  }

  // Outbound plugin → server. Called from a specific port's onMessage,
  // so we know which frame the payload came from and can associate any
  // reported document.id with that port.
  function handleContentSend(port: ContentPort, data: any) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (data?.__control === "document-state") {
      const documentId =
        typeof data?.document?.id === "string" ? data.document.id : null;
      if (documentId) {
        rememberDocumentForPort(port, documentId);
      }
    }
    if (data?.__control === "compat-report") {
      const { drawioVersion, state: reportState, floor, detail } = data;
      switch (reportState) {
        case "ok":
          updateCompatState({ kind: "ok", version: drawioVersion });
          break;
        case "below-floor":
          updateCompatState({ kind: "below-floor", version: drawioVersion, floor });
          break;
        case "above-window":
          updateCompatState({
            kind: "above-window",
            version: drawioVersion,
            lastSupportedMin: detail ?? "",
          });
          break;
        case "no-version":
          updateCompatState({
            kind: "no-version",
            reason: detail === "unparseable" ? "unparseable" : "missing",
          });
          break;
        default:
          console.debug("[background] compat-report: unknown state", reportState);
      }
    }
    const ser = JSON.stringify(data);
    console.debug(`[background] received from content`, { received: data, sending: ser });
    socket.send(ser);
  }

  // Handle messages from popup. Content scripts now send via their long-lived
  // port so background can identify the sender frame for document routing.
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle connection state request from popup
    if (message.type === "GET_CONNECTION_STATE") {
      console.debug("[background] Connection state requested by popup");
      sendResponse({ state: currentConnectionState });
    }

    // Handle compat state request from popup
    if (message.type === "GET_COMPAT_STATE") {
      sendResponse({ state: currentCompatState });
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
          const newConfig = changes[CONFIG_STORAGE_KEY].newValue as ExtensionConfig | undefined;
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
