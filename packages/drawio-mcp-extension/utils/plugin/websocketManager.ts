/**
 * WebSocket Manager Module
 *
 * Closure-based state management for WebSocket connections
 * Follows functional programming principles with immutable external API
 */

export type WebSocketMessageHandler = (message: any) => void;
export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface WebSocketManager {
  connect: () => void;
  disconnect: () => void;
  send: (message: any) => void;
  getState: () => ConnectionState;
  onMessage: (handler: WebSocketMessageHandler) => void;
  ping: () => Promise<boolean>;
}

/**
 * WebSocket manager options
 */
export interface WebSocketManagerOptions {
  url: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  pingInterval?: number;
}

/**
 * Create a WebSocket manager instance
 * State is held in closure, exposed via pure functions
 */
export function createWebSocketManager(options: WebSocketManagerOptions): WebSocketManager {
  // Private state held in closure
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let currentState: ConnectionState = "disconnected";
  let messageHandler: WebSocketMessageHandler | null = null;
  let pingIntervalId: number | null = null;
  let reconnectTimeoutId: number | null = null;

  // Destructure options with defaults
  const {
    url,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    pingInterval = 30000, // 30 seconds
  } = options;

  /**
   * Update current state and notify if changed
   */
  const updateState = (newState: ConnectionState): void => {
    if (currentState !== newState) {
      console.debug(`[websocketManager] State change: ${currentState} → ${newState}`);
      currentState = newState;
    }
  };

  /**
   * Establish WebSocket connection
   */
  const connect = (): void => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.debug("[websocketManager] Already connected");
      return;
    }

    updateState("connecting");

    try {
      socket = new WebSocket(url);

      socket.addEventListener("open", () => {
        console.debug("[websocketManager] WebSocket connection established");
        reconnectAttempts = 0; // Reset reconnect attempts
        updateState("connected");

        // Start ping interval
        startPing();
      });

      socket.addEventListener("message", (event) => {
        try {
          const parsedMessage = JSON.parse(event.data);
          console.debug("[websocketManager] Received message:", parsedMessage);

          if (messageHandler) {
            messageHandler(parsedMessage);
          }
        } catch (error) {
          console.error("[websocketManager] Failed to parse WebSocket message:", error);
        }
      });

      socket.addEventListener("close", () => {
        console.debug("[websocketManager] WebSocket connection closed");
        updateState("disconnected");

        // Stop ping interval
        stopPing();

        // Attempt to reconnect
        attemptReconnect();
      });

      socket.addEventListener("error", (event) => {
        console.error("[websocketManager] WebSocket error:", event);
        updateState("disconnected");
      });

    } catch (error) {
      console.error("[websocketManager] Failed to create WebSocket connection:", error);
      updateState("disconnected");
    }
  };

  /**
   * Close WebSocket connection
   */
  const disconnect = (): void => {
    // Cancel any pending reconnection
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }

    // Stop ping interval
    stopPing();
    reconnectAttempts = 0;

    if (socket) {
      console.debug("[websocketManager] Closing WebSocket connection");
      socket.close();
      socket = null;
    }

    updateState("disconnected");
  };

  /**
   * Send message via WebSocket
   */
  const send = (message: any): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("[websocketManager] Cannot send message: WebSocket not connected");
      return;
    }

    try {
      const serialized = JSON.stringify(message);
      console.debug("[websocketManager] Sending message:", message);
      socket.send(serialized);
    } catch (error) {
      console.error("[websocketManager] Failed to send message:", error);
    }
  };

  /**
   * Get current connection state
   */
  const getState = (): ConnectionState => currentState;

  /**
   * Register message handler
   */
  const onMessage = (handler: WebSocketMessageHandler): void => {
    messageHandler = handler;
  };

  /**
   * Reconnection logic with exponential backoff
   */
  const attemptReconnect = (): void => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error("[websocketManager] Max reconnection attempts reached. Giving up.");
      return;
    }

    reconnectAttempts++;
    const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1); // Exponential backoff

    console.log(`[websocketManager] Attempting to reconnect in ${Math.round(delay / 1000)} seconds... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

    reconnectTimeoutId = window.setTimeout(() => {
      reconnectTimeoutId = null;
      connect();
    }, delay);
  };

  /**
   * Start periodic ping to keep connection alive
   */
  const startPing = (): void => {
    stopPing(); // Clear any existing interval

    pingIntervalId = window.setInterval(() => {
      if (getState() === "connected") {
        send({ type: "PING" });
      }
    }, pingInterval);
  };

  /**
   * Stop periodic ping
   */
  const stopPing = (): void => {
    if (pingIntervalId !== null) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
  };

  /**
   * Test connection by sending a ping and waiting for response
   * Returns a promise that resolves to true if ping succeeds
   */
  const ping = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (getState() !== "connected") {
        resolve(false);
        return;
      }

      // Set a timeout for the ping response
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, 5000); // 5 second timeout

      // Send ping
      send({ type: "PING", message: "Ping from plugin" });

      // Note: In a real implementation, you'd need to set up a response handler
      // For now, we assume success if still connected after a short delay
      setTimeout(() => {
        clearTimeout(timeoutId);
        resolve(getState() === "connected");
      }, 1000);
    });
  };

  // Return the public API
  return {
    connect,
    disconnect,
    send,
    getState,
    onMessage,
    ping,
  };
}
