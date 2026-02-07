/**
 * Tests for resolveShape style fallback branches in tools.ts.
 *
 * These tests mock the Azure icon library to return shapes with
 * undefined style, exercising the `?? ""` fallback on lines 53 and 66.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Mock azure_icon_library before importing tools — vitest hoists vi.mock
vi.mock("../src/shapes/azure_icon_library.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shapes/azure_icon_library.js")>();
  return {
    ...actual,
    getAzureShapeByName: vi.fn(),
    searchAzureIcons: vi.fn(),
  };
});

import { handlers } from "../src/tools.js";
import { diagram } from "../src/diagram_model.js";
import { getAzureShapeByName, searchAzureIcons } from "../src/shapes/azure_icon_library.js";

const mockGetAzureShapeByName = vi.mocked(getAzureShapeByName);
const mockSearchAzureIcons = vi.mocked(searchAzureIcons);

function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") throw new Error(`Expected text content, got ${content.type}`);
  return JSON.parse(content.text);
}

beforeEach(() => {
  diagram.clear();
  mockGetAzureShapeByName.mockReset();
  mockSearchAzureIcons.mockReset();
});

describe("resolveShape style ?? fallback", () => {
  it("should default to empty string when Azure exact match has undefined style", async () => {
    mockGetAzureShapeByName.mockReturnValue({
      id: "no-style-shape",
      title: "No Style Shape",
      style: undefined,
      width: 50,
      height: 50,
      xml: "<test/>",
    });

    const result = await handlers["get-shape-by-name"]({ shape_name: "no-style-azure-shape" });
    const parsed = parseResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.shape.style).toBe("");
    expect(parsed.data.shape.name).toBe("No Style Shape");
  });

  it("should default to empty string when Azure fuzzy match has undefined style", async () => {
    // No exact match
    mockGetAzureShapeByName.mockReturnValue(undefined);
    // Fuzzy returns shape without style
    mockSearchAzureIcons.mockReturnValue([
      {
        id: "fuzzy-no-style",
        title: "Fuzzy No Style",
        style: undefined,
        width: 60,
        height: 60,
        score: 0.8,
        xml: "<mxGraphModel/>",
      },
    ]);

    // Use a name that won't match basic shapes
    const result = await handlers["get-shape-by-name"]({ shape_name: "xyzunknown" });
    const parsed = parseResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.shape.style).toBe("");
    expect(parsed.data.shape.name).toBe("Fuzzy No Style");
  });
});
