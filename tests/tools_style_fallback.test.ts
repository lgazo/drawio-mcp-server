/**
 * Tests for resolveShape style fallback branches in tools.ts.
 *
 * In Node.js/Vitest, these tests used vi.mock() to stub the Azure icon library.
 * In Deno, we instead create a temp XML library file with shapes that lack
 * image data URLs (so extractStyle() returns undefined), load it via
 * initializeShapes(tempFile), and exercise the `?? ""` fallback on lines 53 and 66
 * through the real handler functions.
 */
import { describe, it, afterAll } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers, clearResolveShapeCache, setMaxResolveCacheSize, getResolveCacheSize } from "../src/tools.ts";
import { diagram } from "../src/diagram_model.ts";
import {
  initializeShapes,
  setAzureIconLibraryPath,
  resetAzureIconLibrary,
} from "../src/shapes/azure_icon_library.ts";

/** Parse the JSON payload out of a handler result. */
function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") throw new Error(`Expected text content, got ${content.type}`);
  return JSON.parse(content.text);
}

/**
 * XML library that defines shapes WITHOUT image data URLs in their style.
 * When the library parser extracts styles, it looks for a `data:image` URL
 * inside a `style` attribute. These shapes have `fillColor` only, so
 * `extractStyle()` returns `undefined`, exercising the `?? ""` fallback.
 *
 * We include two uniquely-named shapes:
 * - "ExactMatchNoStyle" — will be found by exact title lookup
 * - "FuzzyMatchNoStyle" — will be found by fuzzy search when a partial query is used
 */
const TEMP_XML = `<mxlibrary>[
  {"xml":"<mxGraphModel><root><mxCell style=\\"fillColor=#FF0000\\"/></root></mxGraphModel>","w":50,"h":50,"title":"ExactMatchNoStyle"},
  {"xml":"<mxGraphModel><root><mxCell style=\\"fillColor=#00FF00\\"/></root></mxGraphModel>","w":60,"h":60,"title":"FuzzyMatchNoStyle"}
]</mxlibrary>`;

// Create the temp XML file and load the custom library
const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
Deno.writeTextFileSync(tmpFile, TEMP_XML);
initializeShapes(tmpFile);
clearResolveShapeCache();

// Restore the real library after all tests in this file
afterAll(() => {
  Deno.removeSync(tmpFile);
  setAzureIconLibraryPath(
    resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"),
  );
  resetAzureIconLibrary();
  clearResolveShapeCache();
});

describe("resolveShape style ?? fallback", () => {
  it("should default to empty string when Azure exact match has undefined style", async () => {
    diagram.clear();
    const result = await handlers["get-shape-by-name"]({ shape_name: "ExactMatchNoStyle" });
    const parsed = parseResult(result);
    assertEquals(parsed.success, true);
    assertEquals(parsed.data.shape.style, "");
    assertEquals(parsed.data.shape.name, "ExactMatchNoStyle");
  });

  it("should default to empty string when Azure fuzzy match has undefined style", async () => {
    diagram.clear();
    // Use a query that won't match basic shapes but will fuzzy-match "FuzzyMatchNoStyle"
    const result = await handlers["get-shape-by-name"]({ shape_name: "FuzzyMatchNo" });
    const parsed = parseResult(result);
    assertEquals(parsed.success, true);
    assertEquals(parsed.data.shape.style, "");
    assertEquals(parsed.data.shape.name, "FuzzyMatchNoStyle");
  });
});

describe("resolveShape cache eviction", () => {
  it("evicts resolve cache when max size is exceeded", async () => {
    clearResolveShapeCache();
    const originalMax = 10_000; // default
    setMaxResolveCacheSize(2);
    try {
      // Fill cache with 2 entries (at capacity)
      await handlers["get-shape-by-name"]({ shape_name: "ExactMatchNoStyle" });
      await handlers["get-shape-by-name"]({ shape_name: "FuzzyMatchNoStyle" });
      assertEquals(getResolveCacheSize(), 2, "Cache should have 2 entries");
      // Third distinct query triggers eviction (cache clears then adds the new entry)
      await handlers["get-shape-by-name"]({ shape_name: "nonexistent-shape-xyz" });
      // After eviction: cache was cleared, then the new lookup was added
      // "nonexistent-shape-xyz" resolves to undefined and is cached via .has() sentinel
      assertEquals(getResolveCacheSize(), 1, "Cache should have 1 entry after eviction");
    } finally {
      setMaxResolveCacheSize(originalMax);
      clearResolveShapeCache();
    }
  });
});
