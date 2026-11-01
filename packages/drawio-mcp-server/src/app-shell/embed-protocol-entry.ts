// Bundled by scripts/build-app-shell.mjs into build/app-shell/embed-protocol.iife.js.
// Exposes the draw.io embed postMessage protocol helpers to the shell HTML
// (spliced inline there); the pure logic lives in embed-protocol.ts.
import { encodeEditorAction, parseEditorMessage } from "./embed-protocol.js";

(globalThis as unknown as Record<string, unknown>).DrawioEmbedProtocol = {
  parseEditorMessage,
  encodeEditorAction,
};
