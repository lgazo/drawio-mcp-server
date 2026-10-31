/**
 * Pure helpers for the draw.io embed postMessage protocol (`proto=json`).
 *
 * Root cause of the framed-editor cold-start failure: draw.io's embed
 * proto=json message loop runs `data = JSON.parse(data)` on EVERY
 * parent->editor postMessage (drawio webapp `js/diagramly/EditorUi.js`,
 * `installMessageHandler`) and silently `return`s when parsing throws or
 * yields null — an already-parsed object coerces to "[object Object]",
 * throws, and is dropped. Editor->parent events go the same way:
 * `JSON.stringify({event: 'init'})` (EditorUi.js, installMessageHandler).
 *
 * So the shell must send JSON strings and parse the editor's JSON-string
 * events. When plain objects were sent, the editor never processed the
 * `load` action, so `initializeEmbedMode`'s handler callback never ran and
 * `this.setCurrentFile(new EmbedFile(this, xml, {}))` (EditorUi.js
 * initializeEmbedMode) never materialized a current file — `ui.getCurrentFile()`
 * stayed null and mcp-plugin.js had nothing to register for list-documents.
 */

export type DrawioEmbedEvent = {
  event: string;
  [key: string]: unknown;
};

export function parseEditorMessage(raw: unknown): DrawioEmbedEvent | null {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const event = (data as Record<string, unknown>).event;
  if (typeof event !== "string" || event.length === 0) {
    return null;
  }
  return data as DrawioEmbedEvent;
}

/**
 * Encodes an action for the framed editor. MUST return a JSON string:
 * draw.io's proto=json handler parses every incoming parent message with
 * JSON.parse and silently ignores anything that fails to parse.
 */
export function encodeEditorAction(
  action: string,
  fields: Record<string, unknown> = {},
): string {
  return JSON.stringify({ action, ...fields });
}
