import { useState, useEffect } from "react";
import "./App.css";
import { getWebSocketUrl } from "../../config";
import { CompatBanner } from "./CompatBanner.js";

type ConnectionState = "connected" | "connecting" | "disconnected";

type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [compatState, setCompatState] = useState<CompatState>({ kind: "unknown" });
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    // Load current effective WebSocket URL (override or derived default)
    getWebSocketUrl()
      .then(setCurrentUrl)
      .catch(error => console.error("Error loading config:", error));

    // Request connection state from background script when popup opens
    browser.runtime.sendMessage({ type: "GET_CONNECTION_STATE" })
      .then((response) => {
        if (response && response.state) {
          setConnectionState(response.state);
        }
      })
      .catch(error => console.error("Error getting connection state:", error));

    // Listen for connection state updates
    const listener = (message: any) => {
      if (message.type === "CONNECTION_STATE_UPDATE") {
        setConnectionState(message.state);
      }
      return true;
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    browser.runtime.sendMessage({ type: "GET_COMPAT_STATE" })
      .then((response) => { if (response?.state) setCompatState(response.state); })
      .catch((error) => console.error("compat state fetch failed:", error));

    const listener = (message: any) => {
      if (message.type === "COMPAT_STATE_UPDATE") setCompatState(message.state);
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  // Get the appropriate logo based on connection state
  const logoSrc = `/icon/logo_${connectionState}_128.png`;

  return (
    <>
      <CompatBanner state={compatState} />
      <div>
        <a href="https://github.com/lgazo/drawio-mcp-server" target="_blank">
          <img src={logoSrc} className="logo" alt="Draw.io MCP logo" />
        </a>
      </div>
      <h1>Draw.io MCP</h1>
      <div className="header-actions">
        <button
          onClick={() => browser.runtime.openOptionsPage()}
          className="settings-button"
          title="Open Settings"
        >
          ⚙️ Settings
        </button>
      </div>
      <div className="connection-status">
        <div className={`status-indicator ${connectionState}`}></div>
        <span>Status: {connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}</span>
      </div>
      <div className="card">
        <p>
          The WebSocket connection is currently <strong>{connectionState}</strong>
          {currentUrl && (
            <>
              {" at "}
              <strong className="connection-url">{currentUrl}</strong>
            </>
          )}
          .
        </p>
        {connectionState !== "connected" && (
          <p>
            {connectionState === "connecting"
              ? "Attempting to connect to the MCP server..."
              : "Not connected to the MCP server. The server may be offline."}
          </p>
        )}
      </div>

      <div className="card">
        <div className="button-container">
          <button
            onClick={() => {
              browser.runtime.sendMessage({ type: "SEND_PING_TO_SERVER" })
                .catch(error => console.error("Error sending ping:", error));
            }}
            disabled={connectionState !== "connected"}
            className="ping-button"
          >
            Ping Server
          </button>
          
          {connectionState === "disconnected" && (
            <button
              onClick={() => {
                browser.runtime.sendMessage({ type: "RECONNECT_TO_SERVER" })
                  .catch(error => console.error("Error reconnecting:", error));
              }}
              className="connect-button"
            >
              Connect
            </button>
          )}
        </div>
      </div>
      
      <div className="card">
        <p>Please open <a href="https://app.diagrams.net/" target="_blank">Draw.io</a> website to use MCP features</p>
      </div>

      <div className="card align-left features-section">
        <h3 
          className="features-heading" 
          onClick={() => setFeaturesExpanded(!featuresExpanded)}
        >
          Supported Features: <span className={`expand-icon ${featuresExpanded ? 'expanded' : ''}`}>▶</span>
        </h3>
        {featuresExpanded && (
          <ul className="features-list">
            <li>Get selected cell</li>
            <li>Add rectangle shape</li>
            <li>Add connection line (edge)</li>
            <li>Delete cell</li>
            <li>Get shape categories</li>
            <li>Add specific shape</li>
          </ul>
        )}
      </div>
    </>
  );
}

export default App;
