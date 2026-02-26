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

export interface WebSocketManagerOptions {
  url: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  pingInterval?: number;
}

export function createWebSocketManager(
  options: WebSocketManagerOptions,
): WebSocketManager {
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let currentState: ConnectionState = "disconnected";
  let messageHandler: WebSocketMessageHandler | null = null;
  let pingIntervalId: number | null = null;
  let reconnectTimeoutId: number | null = null;

  const {
    url,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    pingInterval = 30000,
  } = options;

  const updateState = (newState: ConnectionState): void => {
    if (currentState !== newState) {
      console.debug(
        `[websocketManager] State change: ${currentState} → ${newState}`,
      );
      currentState = newState;
    }
  };

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
        reconnectAttempts = 0;
        updateState("connected");
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
          console.error(
            "[websocketManager] Failed to parse WebSocket message:",
            error,
          );
        }
      });

      socket.addEventListener("close", () => {
        console.debug("[websocketManager] WebSocket connection closed");
        updateState("disconnected");
        stopPing();
        attemptReconnect();
      });

      socket.addEventListener("error", (event) => {
        console.error("[websocketManager] WebSocket error:", event);
        updateState("disconnected");
      });
    } catch (error) {
      console.error(
        "[websocketManager] Failed to create WebSocket connection:",
        error,
      );
      updateState("disconnected");
    }
  };

  const disconnect = (): void => {
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }

    stopPing();
    reconnectAttempts = 0;

    if (socket) {
      console.debug("[websocketManager] Closing WebSocket connection");
      socket.close();
      socket = null;
    }

    updateState("disconnected");
  };

  const send = (message: any): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn(
        "[websocketManager] Cannot send message: WebSocket not connected",
      );
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

  const getState = (): ConnectionState => currentState;

  const onMessage = (handler: WebSocketMessageHandler): void => {
    messageHandler = handler;
  };

  const attemptReconnect = (): void => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error(
        "[websocketManager] Max reconnection attempts reached. Giving up.",
      );
      return;
    }

    reconnectAttempts++;
    const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);

    console.log(
      `[websocketManager] Attempting to reconnect in ${Math.round(delay / 1000)} seconds... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
    );

    reconnectTimeoutId = window.setTimeout(() => {
      reconnectTimeoutId = null;
      connect();
    }, delay);
  };

  const startPing = (): void => {
    stopPing();

    pingIntervalId = window.setInterval(() => {
      if (getState() === "connected") {
        send({ type: "PING" });
      }
    }, pingInterval);
  };

  const stopPing = (): void => {
    if (pingIntervalId !== null) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
  };

  const ping = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (getState() !== "connected") {
        resolve(false);
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve(false);
      }, 5000);

      send({ type: "PING", message: "Ping from plugin" });

      setTimeout(() => {
        clearTimeout(timeoutId);
        resolve(getState() === "connected");
      }, 1000);
    });
  };

  return {
    connect,
    disconnect,
    send,
    getState,
    onMessage,
    ping,
  };
}
