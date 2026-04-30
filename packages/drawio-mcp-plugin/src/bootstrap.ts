/**
 * Shared bootstrap for the Draw.io MCP plugin runtime.
 *
 * Used by every entrypoint that loads inside Draw.io: the standalone
 * bundled plugin, the extension's plugin-mode build, and the regular
 * extension content-script. The transport differs per host (direct
 * WebSocket vs. CustomEvent bus), so each caller injects a Transport.
 */

import {
  remove_circular_dependencies,
  serialize_document_info,
  set_active_document_id,
} from "./drawio-tools";
import { reply_name } from "./events";
import { setRuntimeCatalog } from "./shape-library";
import { extractShapesFromSidebar } from "./shape-extractor";
import { toolDefinitions } from "./tool-registry";
import type {
  DrawIOFunction,
  DrawioEventListener,
  DrawioFile,
  DrawioUI,
} from "./types";

export type Transport = {
  send: (message: unknown) => void;
  onMessage: (listener: (message: any) => void) => void;
};

export type BootstrapOptions = {
  ui: DrawioUI;
  transport: Transport;
  enableDocumentState?: boolean;
  enableShapeExtraction?: boolean;
};

export type BootstrapHandle = {
  syncDocumentState: () => void;
  dispose: () => void;
};

const SHAPE_EXTRACTION_MAX_ATTEMPTS = 10;
const SHAPE_EXTRACTION_INTERVAL_MS = 1000;

function generateDocumentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `document-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function bootstrapPlugin(opts: BootstrapOptions): BootstrapHandle {
  const {
    ui,
    transport,
    enableDocumentState = true,
    enableShapeExtraction = true,
  } = opts;

  let currentDocumentId: string | null = null;
  let currentFileRef: DrawioFile | null = null;
  let detachFileListener: (() => void) | null = null;
  const cleanups: Array<() => void> = [];

  const syncDocumentState = () => {
    if (!enableDocumentState) return;
    if (!ui?.getCurrentFile?.() || !currentDocumentId) return;
    transport.send({
      __control: "document-state",
      document: serialize_document_info(ui, currentDocumentId),
    });
  };

  const detachCurrentFileListener = () => {
    if (detachFileListener) {
      detachFileListener();
      detachFileListener = null;
    }
    currentFileRef = null;
  };

  const bindCurrentFileListener = (file: DrawioFile | null) => {
    detachCurrentFileListener();
    currentFileRef = file;
    if (!file?.addListener || !file?.removeListener) return;

    const onDescriptorChanged: DrawioEventListener = () => syncDocumentState();
    file.addListener("descriptorChanged", onDescriptorChanged);

    detachFileListener = () => {
      try {
        file.removeListener?.("descriptorChanged", onDescriptorChanged);
      } catch (error) {
        console.warn(
          "[plugin] Failed to remove file descriptor listener:",
          error,
        );
      }
    };
  };

  const refreshActiveDocument = (forceNewId: boolean) => {
    const file = ui?.getCurrentFile?.() ?? null;

    if (!file) {
      currentDocumentId = null;
      set_active_document_id(null);
      detachCurrentFileListener();
      return;
    }

    if (forceNewId || !currentDocumentId || file !== currentFileRef) {
      currentDocumentId = generateDocumentId();
      set_active_document_id(currentDocumentId);
      bindCurrentFileListener(file);
      return;
    }

    if (file !== currentFileRef) {
      bindCurrentFileListener(file);
    }
  };

  const handleDocumentStateChange = (forceNewId: boolean) => {
    refreshActiveDocument(forceNewId);
    syncDocumentState();
  };

  const registerDocumentStateListeners = () => {
    const listen = (eventName: string, forceNewId: boolean) => {
      ui.editor?.addListener?.(eventName, () => {
        handleDocumentStateChange(forceNewId);
      });
    };

    listen("fileLoaded", true);
    listen("pageSelected", false);
    listen("pageRenamed", false);
    listen("pageMoved", false);
    listen("pagesPatched", false);

    refreshActiveDocument(false);
  };

  const buildToolHandler = (
    toolName: string,
    parameterKeys: Set<string>,
    executeFunction: DrawIOFunction,
  ) => {
    return (request: any): void => {
      const options = Object.entries(request).reduce(
        (acc, [key, value]) => {
          if (parameterKeys.has(key)) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );

      const sendReply = (success: boolean, payload: unknown) => {
        const reply: Record<string, unknown> = {
          __event: reply_name(toolName, request.__request_id),
          __request_id: request.__request_id,
          success,
        };
        if (success) {
          reply.result = remove_circular_dependencies(payload);
        } else {
          reply.error = remove_circular_dependencies(payload);
        }
        transport.send(reply);
        if (success) {
          syncDocumentState();
        }
      };

      try {
        const result = executeFunction(ui, options);
        if (result instanceof Promise) {
          result.then(
            (resolved) => sendReply(true, resolved),
            (error) => {
              console.error(
                `[plugin] Async tool ${toolName} failed for request ID ${request.__request_id}:`,
                error,
              );
              sendReply(false, error);
            },
          );
          return;
        }
        sendReply(true, result);
      } catch (error) {
        console.error(
          `[plugin] Tool ${toolName} failed for request ID ${request.__request_id}:`,
          error,
        );
        sendReply(false, error);
      }
    };
  };

  const toolHandlers = new Map<string, (request: any) => void>();
  toolDefinitions.forEach((def) => {
    toolHandlers.set(
      def.name,
      buildToolHandler(def.name, def.params, def.handler),
    );
    console.debug(`[plugin] registered tool ${def.name}`);
  });

  transport.onMessage((message: any) => {
    if (!message) return;

    if (message.__control === "sync-document-state") {
      handleDocumentStateChange(false);
      return;
    }

    const handler =
      typeof message.__event === "string"
        ? toolHandlers.get(message.__event)
        : undefined;
    if (handler) {
      handler(message);
    }
  });

  if (enableDocumentState) {
    registerDocumentStateListeners();
  }

  if (enableShapeExtraction) {
    const tryExtractShapes = (): boolean => {
      try {
        if (!ui?.sidebar) return false;
        const map = extractShapesFromSidebar(ui);
        if (map.size === 0) return false;
        const runtime = new Map(
          [...map].map(
            ([k, v]) =>
              [
                k,
                { style: v.style, category: v.category, name: v.name },
              ] as const,
          ),
        );
        setRuntimeCatalog(runtime);
        console.info(
          `[plugin] extracted ${map.size} vendor shapes from drawio sidebar`,
        );
        return true;
      } catch (err) {
        console.warn("[plugin] shape extraction attempt failed", err);
        return false;
      }
    };

    if (!tryExtractShapes()) {
      let attempts = 0;
      const intervalId = setInterval(() => {
        attempts += 1;
        if (
          tryExtractShapes() ||
          attempts >= SHAPE_EXTRACTION_MAX_ATTEMPTS
        ) {
          clearInterval(intervalId);
          if (attempts >= SHAPE_EXTRACTION_MAX_ATTEMPTS) {
            console.error(
              "[plugin] shape extraction gave up after retries; vendor shapes unavailable",
            );
          }
        }
      }, SHAPE_EXTRACTION_INTERVAL_MS);
      cleanups.push(() => clearInterval(intervalId));
    }
  }

  return {
    syncDocumentState,
    dispose: () => {
      detachCurrentFileListener();
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };
}
