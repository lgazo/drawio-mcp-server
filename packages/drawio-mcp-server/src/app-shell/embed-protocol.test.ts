import { describe, expect, it } from "@jest/globals";

import { encodeEditorAction, parseEditorMessage } from "./embed-protocol.js";

describe("embed-protocol: parseEditorMessage", () => {
  // draw.io posts editor->parent events as JSON strings
  // (EditorUi.js installMessageHandler: JSON.stringify({event: 'init'})).
  it("parses JSON-string events from the editor window", () => {
    expect(parseEditorMessage(JSON.stringify({ event: "init" }))).toEqual({
      event: "init",
    });
    expect(
      parseEditorMessage(JSON.stringify({ event: "autosave", xml: "<mx>" })),
    ).toEqual({ event: "autosave", xml: "<mx>" });
  });

  it("tolerates already-parsed event objects", () => {
    expect(parseEditorMessage({ event: "init" })).toEqual({ event: "init" });
  });

  it("rejects payloads that are not drawio events", () => {
    // draw.io drops unparseable incoming messages silently; the shell must
    // do the same and never treat foreign traffic as lifecycle events.
    expect(parseEditorMessage("not json")).toBeNull();
    expect(parseEditorMessage("{event:'init'}")).toBeNull();
    expect(parseEditorMessage({})).toBeNull();
    expect(parseEditorMessage({ event: "" })).toBeNull();
    expect(parseEditorMessage({ event: 1 })).toBeNull();
    expect(parseEditorMessage(["event"])).toBeNull();
    expect(parseEditorMessage(null)).toBeNull();
    expect(parseEditorMessage(undefined)).toBeNull();
    expect(parseEditorMessage(42)).toBeNull();
  });
});

describe("embed-protocol: encodeEditorAction", () => {
  // Root cause of the framed editor never registering for list-documents:
  // draw.io's proto=json parent->editor handler runs JSON.parse(data) and
  // silently returns on failure, so plain JS objects posted to the editor
  // were dropped before the load action ever ran — the EmbedFile was never
  // created. Every action must be encoded as a JSON string.
  it("encodes the load action as a JSON STRING, not an object", () => {
    const encoded = encodeEditorAction("load", {
      xml: "<mxfile/>",
      autosave: 1,
    });
    expect(typeof encoded).toBe("string");
    expect(JSON.parse(encoded)).toEqual({
      action: "load",
      xml: "<mxfile/>",
      autosave: 1,
    });
  });

  it("encodes actions without extra fields", () => {
    expect(JSON.parse(encodeEditorAction("configure"))).toEqual({
      action: "configure",
    });
    expect(JSON.parse(encodeEditorAction("configure", { config: {} }))).toEqual(
      { action: "configure", config: {} },
    );
  });
});
