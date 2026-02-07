import { searchAzureIcons, getAzureIconLibrary } from "../src/shapes/azure_icon_library.js";

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
  test.each(testQueries)('query "%s" returns at least one result', (query) => {
    const results = searchAzureIcons(query, 5);
    expect(results.length).toBeGreaterThan(0);
  });

  test.each(testQueries)('query "%s" returns at most 5 results', (query) => {
    const results = searchAzureIcons(query, 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test("library has a non-trivial number of shapes", () => {
    const iconLib = getAzureIconLibrary();
    expect(iconLib.shapes.length).toBeGreaterThan(100);
  });
});
