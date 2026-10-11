import { useState, useEffect } from "react";
import "./App.css";
import { getWebSocketUrl } from "../../config";
import type { ConnectedDocumentInfo } from "../../types";
import { useI18n } from "../../utils/useI18n";
import { CompatBanner } from "./CompatBanner.js";

type ConnectionState = "connected" | "connecting" | "disconnected";

type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

function App() {
  const { t } = useI18n();
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [compatState, setCompatState] = useState<CompatState>({ kind: "unknown" });
  const [documents, setDocuments] = useState<ConnectedDocumentInfo[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    getWebSocketUrl()
      .then(setCurrentUrl)
      .catch(error => console.error("Error loading config:", error));

    browser.runtime.sendMessage({ type: "GET_CONNECTION_STATE" })
      .then((response) => {
        if (response && response.state) {
          setConnectionState(response.state);
        }
      })
      .catch(error => console.error("Error getting connection state:", error));

    const listener = (message: any) => {
      if (message.type === "CONNECTION_STATE_UPDATE") {
        setConnectionState(message.state);
      }
      return true;
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
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

  useEffect(() => {
    browser.runtime.sendMessage({ type: "GET_DOCUMENTS" })
      .then((response) => {
        if (response?.documents) setDocuments(response.documents);
      })
      .catch((error) => console.error("documents fetch failed:", error));

    const listener = (message: any) => {
      if (message.type === "DOCUMENTS_UPDATE" && Array.isArray(message.documents)) {
        setDocuments(message.documents);
      }
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const logoSrc = `/icon/logo_${connectionState}_128.png`;

  const stateLabel = (state: ConnectionState) =>
    t(
      state === "connected" ? "state_connected" : state === "connecting" ? "state_connecting" : "state_disconnected",
    );

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).catch((err) =>
      console.error("clipboard write failed:", err),
    );
  };

  return (
    <>
      <CompatBanner state={compatState} />
      <div>
        <a href="https://github.com/lgazo/drawio-mcp-server" target="_blank">
          <img src={logoSrc} className="logo" alt="Draw.io MCP logo" />
        </a>
      </div>
      <h1>{t("popup_title")}</h1>
      <div className="header-actions">
        <button
          onClick={() => browser.runtime.openOptionsPage()}
          className="settings-button"
          title={t("popup_open_settings")}
        >
          {t("popup_settings_button")}
        </button>
      </div>
      <div className="connection-status">
        <div className={`status-indicator ${connectionState}`}></div>
        <span>{t("popup_status_label", stateLabel(connectionState))}</span>
      </div>
      <div className="card">
        <p>
          {currentUrl
            ? t("ws_current_with_url", stateLabel(connectionState), currentUrl)
            : t("ws_current_no_url", stateLabel(connectionState))}
        </p>
        {connectionState !== "connected" && (
          <p>
            {connectionState === "connecting"
              ? t("ws_connecting_hint")
              : t("ws_disconnected_hint")}
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
            {t("popup_ping_server")}
          </button>

          {connectionState === "disconnected" && (
            <button
              onClick={() => {
                browser.runtime.sendMessage({ type: "RECONNECT_TO_SERVER" })
                  .catch(error => console.error("Error reconnecting:", error));
              }}
              className="connect-button"
            >
              {t("popup_connect")}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <p>
          {t("open_drawio_before")}
          <a href="https://app.diagrams.net/" target="_blank">Draw.io</a>
          {t("open_drawio_after")}
        </p>
      </div>

      <div className="card align-left documents-section">
        <h3 className="documents-heading">
          {t("documents_heading", String(documents.length))}
        </h3>
        {documents.length === 0 ? (
          <p className="empty">{t("documents_empty")}</p>
        ) : (
          <ul className="documents-list">
            {documents.map((doc) => (
              <li key={doc.id} className="document-row">
                <div className="document-title-line">
                  <strong>{doc.title ?? t("document_untitled")}</strong>
                  <span className="document-id" title={doc.id}>
                    {doc.id.slice(0, 8)}…
                  </span>
                  <button
                    type="button"
                    className="copy-id-button"
                    title={t("document_copy_id_title")}
                    onClick={() => copyId(doc.id)}
                  >
                    📋
                  </button>
                </div>
                <div className="document-meta">
                  {t(
                    "document_meta",
                    doc.mode ?? "—",
                    String(doc.page_count),
                    doc.current_page?.name ?? "—",
                  )}
                </div>
                {doc.file_url && (
                  <div className="document-url" title={doc.file_url}>
                    <code>{doc.file_url}</code>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default App;