import { describe, it } from "@std/testing/bdd";
import { assertGreater, assertLessOrEqual } from "@std/assert";
import { searchAzureIcons, getAzureIconLibrary } from "../src/shapes/azure_icon_library.ts";

const testQueries = [
  "container",
  "front door",
  "app service",
  "aks",
  "kubernetes",
  "storage",
  "app",
  "function",
  "sql",
  "api management",
];

describe("searchAzureIcons integration", () => {
  // Replaces test.each — Deno uses a simple for loop
  for (const query of testQueries) {
    it(`query "${query}" returns at least one result`, () => {
      const results = searchAzureIcons(query, 5);
      assertGreater(results.length, 0);
    });

    it(`query "${query}" returns at most 5 results`, () => {
      const results = searchAzureIcons(query, 5);
      assertLessOrEqual(results.length, 5);
    });
  }

  it("library has a non-trivial number of shapes", () => {
    const iconLib = getAzureIconLibrary();
    assertGreater(iconLib.shapes.length, 100);
  });
});
