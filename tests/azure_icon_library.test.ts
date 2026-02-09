/**
 * Tests for the Azure icon library loading, categorization, search, and alias resolution.
 * Verifies shape parsing from XML, category assignment, fuzzy search, and singleton caching.
 */
import { describe, it, beforeAll, afterEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import { resolve } from "@std/path";
import {
  loadAzureIconLibrary,
  getAzureIconLibrary,
  searchAzureIcons,
  getAzureCategories,
  getShapesInCategory,
  getAzureShapeByName,
  resetAzureIconLibrary,
  setAzureIconLibraryPath,
  initializeShapes,
  AZURE_SHAPE_ALIASES,
  resolveAzureAlias,
  resolveAllAzureAliases,
  displayTitle,
  setMaxSearchCacheSize,
  getSearchCacheSize,
} from "../src/shapes/azure_icon_library.ts";
import type { AzureIconLibrary } from "../src/shapes/azure_icon_library.ts";

// Load library once for all tests
let library: AzureIconLibrary;

beforeAll(() => {
  library = loadAzureIconLibrary();
});

describe("loadAzureIconLibrary", () => {
  it("loads shapes from the XML file", () => {
    assert(library.shapes.length > 0);
  });

  it("each shape has required fields", () => {
    for (const shape of library.shapes) {
      assert(shape.id);
      assert(shape.title);
      assert(shape.width > 0);
      assert(shape.height > 0);
      assert(shape.xml);
    }
  });

  it("builds indexByTitle for lookup", () => {
    assert(library.indexByTitle.size > 0);
  });

  it("returns empty library for non-existent path", () => {
    const empty = loadAzureIconLibrary("/non/existent/path.xml");
    assertEquals(empty.shapes.length, 0);
    assertEquals(empty.categories.size, 0);
    assertEquals(empty.indexByTitle.size, 0);
  });

  it("returns empty shapes when XML has no mxlibrary tag", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    try {
      Deno.writeTextFileSync(tmpFile, "<root><nothing/></root>");
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 0);
      assertEquals(result.categories.size, 0);
    } finally {
      Deno.removeSync(tmpFile);
    }
  });

  it("returns empty shapes when mxlibrary contains invalid JSON", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    try {
      Deno.writeTextFileSync(tmpFile, "<mxlibrary>[{invalid json!}]</mxlibrary>");
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 0);
    } finally {
      Deno.removeSync(tmpFile);
    }
  });

  it("returns empty library when path is a directory", () => {
    const tmpDir = Deno.makeTempDirSync();
    try {
      const result = loadAzureIconLibrary(tmpDir);
      assertEquals(result.shapes.length, 0);
    } finally {
      Deno.removeSync(tmpDir);
    }
  });

  it("handles shapes without image data URL in XML", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    const xmlContent = `<mxlibrary>[{"xml":"<mxGraphModel><root><mxCell style=\\"fillColor=#FF0000\\"/></root></mxGraphModel>","w":50,"h":50,"title":"No Image Shape"}]</mxlibrary>`;
    try {
      Deno.writeTextFileSync(tmpFile, xmlContent);
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 1);
      assertEquals(result.shapes[0].style, undefined);
      assertEquals(result.shapes[0].title, "No Image Shape");
    } finally {
      Deno.removeSync(tmpFile);
    }
  });

  it("handles item with missing xml, title, width, and height", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    const xmlContent = `<mxlibrary>[{}]</mxlibrary>`;
    try {
      Deno.writeTextFileSync(tmpFile, xmlContent);
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 1);
      assertEquals(result.shapes[0].xml, "");
      assertEquals(result.shapes[0].title, "shape-0");
      assertEquals(result.shapes[0].id, "shape-0");
      assertEquals(result.shapes[0].width, 48);
      assertEquals(result.shapes[0].height, 48);
    } finally {
      Deno.removeSync(tmpFile);
    }
  });

  it("handles item with non-printable title falling back to shape-N", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    const xmlContent = `<mxlibrary>[{"title":"\\u0000\\u0001","w":10,"h":10}]</mxlibrary>`;
    try {
      Deno.writeTextFileSync(tmpFile, xmlContent);
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 1);
      assertEquals(result.shapes[0].title, "shape-0");
    } finally {
      Deno.removeSync(tmpFile);
    }
  });

  it("falls back to shape-N id when title sanitizes to empty id", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    const xmlContent = `<mxlibrary>[{"title":"+++","w":20,"h":20}]</mxlibrary>`;
    try {
      Deno.writeTextFileSync(tmpFile, xmlContent);
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 1);
      assertEquals(result.shapes[0].title, "+++");
      assertEquals(result.shapes[0].id, "shape-0");
    } finally {
      Deno.removeSync(tmpFile);
    }
  });

  it("handles item with URL-encoded XML (entity references)", () => {
    const tmpFile = Deno.makeTempFileSync({ suffix: ".xml" });
    const xmlContent = `<mxlibrary>[{"xml":"&lt;mxGraphModel&gt;&lt;root/&gt;&lt;/mxGraphModel&gt;","title":"Encoded","w":30,"h":30}]</mxlibrary>`;
    try {
      Deno.writeTextFileSync(tmpFile, xmlContent);
      const result = loadAzureIconLibrary(tmpFile);
      assertEquals(result.shapes.length, 1);
      assertEquals(result.shapes[0].xml, "<mxGraphModel><root/></mxGraphModel>");
    } finally {
      Deno.removeSync(tmpFile);
    }
  });
});

describe("categorizeShapes", () => {
  it("every shape is categorized (no Other category)", () => {
    const otherShapes = library.categories.get("Other") || [];
    assertEquals(otherShapes.length, 0);
  });

  it("total categorized shapes equals total shapes", () => {
    let total = 0;
    for (const shapes of library.categories.values()) {
      total += shapes.length;
    }
    assertEquals(total, library.shapes.length);
  });

  it("no shape object appears in more than one category", () => {
    const seen = new Set<object>();
    for (const [, shapes] of library.categories) {
      for (const shape of shapes) {
        assertEquals(seen.has(shape), false);
        seen.add(shape);
      }
    }
  });

  it("expected core categories exist", () => {
    const categories = Array.from(library.categories.keys());
    const expected = [
      "AI + Machine Learning",
      "Analytics",
      "Compute",
      "Containers",
      "Databases",
      "DevOps",
      "Identity",
      "Integration",
      "IoT",
      "Management + Governance",
      "Networking",
      "Security",
      "Storage",
      "Web",
    ];
    for (const cat of expected) {
      assert(categories.includes(cat));
    }
  });

  it("well-known shapes land in expected categories", () => {
    const cleanTitle = (title: string) =>
      title.replace(/^\d+-icon-service-/, "").replace(/-/g, " ").trim().toLowerCase();

    const expectations: Record<string, string[]> = {
      Compute: ["virtual machine"],
      Networking: ["virtual network", "load balancer", "firewall"],
      Storage: ["storage", "blob"],
      Databases: ["sql", "cosmos"],
      "AI + Machine Learning": ["cognitive", "machine learning"],
      Containers: ["kubernetes", "container"],
      Security: ["key vault", "sentinel"],
      Web: ["app service"],
    };

    for (const [category, keywords] of Object.entries(expectations)) {
      const shapes = library.categories.get(category);
      assertExists(shapes);
      for (const keyword of keywords) {
        const found = shapes!.some((s) => cleanTitle(s.title).includes(keyword));
        assertEquals(found, true);
      }
    }
  });
});

describe("getAzureIconLibrary (cached singleton)", () => {
  it("returns same instance on repeated calls", () => {
    const a = getAzureIconLibrary();
    const b = getAzureIconLibrary();
    assert(a === b);
  });
});

describe("getAzureCategories", () => {
  it("returns sorted category names", () => {
    const categories = getAzureCategories();
    assert(categories.length > 0);
    const sorted = [...categories].sort();
    assertEquals(categories, sorted);
  });

  it("does not include Other", () => {
    const categories = getAzureCategories();
    assert(!categories.includes("Other"));
  });
});

describe("getShapesInCategory", () => {
  it("returns shapes for a valid category", () => {
    const shapes = getShapesInCategory("Compute");
    assert(shapes.length > 0);
    assert(shapes[0].title);
  });

  it("returns empty array for unknown category", () => {
    assertEquals(getShapesInCategory("NonExistentCategory"), []);
  });
});

describe("searchAzureIcons", () => {
  it("finds shapes matching a query", () => {
    const results = searchAzureIcons("virtual machine");
    assert(results.length > 0);
  });

  it("respects limit parameter", () => {
    const results = searchAzureIcons("azure", 3);
    assert(results.length <= 3);
  });

  it("returns shapes without internal search fields", () => {
    const results = searchAzureIcons("storage");
    for (const shape of results) {
      assert(!("searchTitle" in shape));
      assert(!("searchId" in shape));
    }
  });

  it("returns empty for gibberish query", () => {
    const results = searchAzureIcons("xyzzyqwerty12345");
    assertEquals(results.length, 0);
  });

  it("exact title match gets score of 1.0", () => {
    const first = library.shapes[0];
    const results = searchAzureIcons(first.title, 10);
    const exactMatch = results.find(r => r.title === first.title);
    assertExists(exactMatch);
    assertEquals(exactMatch!.score, 1.0);
  });

  it("exact id match gets high score", () => {
    const first = library.shapes[0];
    const results = searchAzureIcons(first.id, 10);
    const idMatch = results.find(r => r.id === first.id);
    assertExists(idMatch);
    assert(idMatch!.score >= 0.95);
  });

  it("alias query injects targets as top results with score 1.0", () => {
    const results = searchAzureIcons("Container Apps", 5);
    assert(results.length >= 2);
    assert(results[0].title.includes("Container-Apps-Environments"));
    assertEquals(results[0].score, 1.0);
    assert(results[1].title.includes("Worker-Container-App"));
    assertEquals(results[1].score, 1.0);
  });

  it("alias does not duplicate the targets in results", () => {
    const results = searchAzureIcons("Container Apps", 10);
    const envResults = results.filter(r => r.title.includes("Container-Apps-Environments"));
    assertEquals(envResults.length, 1);
    const workerResults = results.filter(r => r.title.includes("Worker-Container-App"));
    assertEquals(workerResults.length, 1);
  });

  it("Entra ID alias returns Entra ID Protection as top result", () => {
    const results = searchAzureIcons("Entra ID", 5);
    assert(results.length > 0);
    assert(results[0].title.includes("Entra-ID"));
    assertEquals(results[0].score, 1.0);
  });

  it("Azure Monitor alias returns Azure Monitor Dashboard as top result", () => {
    const results = searchAzureIcons("Azure Monitor", 5);
    assert(results.length > 0);
    assert(results[0].title.includes("Azure-Monitor-Dashboard"));
    assertEquals(results[0].score, 1.0);
  });

  it("Front Doors alias returns Front Door and CDN Profiles as top result", () => {
    const results = searchAzureIcons("Front Doors", 5);
    assert(results.length > 0);
    assert(results[0].title.includes("Front-Door-and-CDN-Profiles"));
    assertEquals(results[0].score, 1.0);
  });

  it("App Service alias returns App Services as top result", () => {
    const results = searchAzureIcons("App Service", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("app-services"));
    assertEquals(results[0].score, 1.0);
  });

  it("Static Web App alias returns Static Apps as top result", () => {
    const results = searchAzureIcons("Static Web App", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("static-apps"));
    assertEquals(results[0].score, 1.0);
  });

  it("Azure Functions alias returns Function Apps as top result", () => {
    const results = searchAzureIcons("Azure Functions", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("function-apps"));
    assertEquals(results[0].score, 1.0);
  });

  it("ACR alias returns Container Registries as top result", () => {
    const results = searchAzureIcons("ACR", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("container-registries"));
    assertEquals(results[0].score, 1.0);
  });

  it("VM alias returns Virtual Machine as top result", () => {
    const results = searchAzureIcons("VM", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("virtual-machine"));
    assertEquals(results[0].score, 1.0);
  });

  it("VNet alias returns Virtual Networks as top result", () => {
    const results = searchAzureIcons("VNet", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("virtual-networks"));
    assertEquals(results[0].score, 1.0);
  });

  it("NSG alias returns Network Security Groups as top result", () => {
    const results = searchAzureIcons("NSG", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("network-security-groups"));
    assertEquals(results[0].score, 1.0);
  });

  it("Azure DNS alias returns DNS Zones as top result", () => {
    const results = searchAzureIcons("Azure DNS", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("dns-zones"));
    assertEquals(results[0].score, 1.0);
  });

  it("Azure Firewall alias returns Firewalls as top result", () => {
    const results = searchAzureIcons("Azure Firewall", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("firewalls"));
    assertEquals(results[0].score, 1.0);
  });

  it("Blob Storage alias returns Blob Block as top result", () => {
    const results = searchAzureIcons("Blob Storage", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("blob-block"));
    assertEquals(results[0].score, 1.0);
  });

  it("Managed Identity alias returns Entra Managed Identities as top result", () => {
    const results = searchAzureIcons("Managed Identity", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("managed-identities"));
    assertEquals(results[0].score, 1.0);
  });

  it("Azure SQL Database alias returns SQL Database as top result", () => {
    const results = searchAzureIcons("Azure SQL Database", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("sql-database"));
    assertEquals(results[0].score, 1.0);
  });

  it("Redis Cache alias returns Cache Redis as top result", () => {
    const results = searchAzureIcons("Redis Cache", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("cache-redis"));
    assertEquals(results[0].score, 1.0);
  });

  it("App Insights alias returns Application Insights as top result", () => {
    const results = searchAzureIcons("App Insights", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("application-insights"));
    assertEquals(results[0].score, 1.0);
  });

  it("Cosmos DB alias returns Azure Cosmos DB as top result", () => {
    const results = searchAzureIcons("Cosmos DB", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("azure-cosmos-db"));
    assertEquals(results[0].score, 1.0);
  });

  it("APIM alias returns API Management Services as top result", () => {
    const results = searchAzureIcons("APIM", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("api-management-services"));
    assertEquals(results[0].score, 1.0);
  });

  it("Load Balancer alias returns Load Balancers as top result", () => {
    const results = searchAzureIcons("Load Balancer", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("load-balancers"));
    assertEquals(results[0].score, 1.0);
  });

  it("Bastion alias returns Bastions as top result", () => {
    const results = searchAzureIcons("Bastion", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("bastions"));
    assertEquals(results[0].score, 1.0);
  });

  it("ExpressRoute alias returns ExpressRoute Circuits as top result", () => {
    const results = searchAzureIcons("ExpressRoute", 5);
    assert(results.length > 0);
    assert(results[0].title.toLowerCase().includes("expressroute-circuits"));
    assertEquals(results[0].score, 1.0);
  });

  it("alias respects limit parameter", () => {
    const results = searchAzureIcons("Container Apps", 2);
    assert(results.length <= 2);
  });

  it("returns cached results for repeated identical queries", () => {
    resetAzureIconLibrary();
    const first = searchAzureIcons("virtual machine", 5);
    const second = searchAzureIcons("virtual machine", 5);
    assertEquals(first, second, "Expected equivalent results from cache");
  });

  it("cache shares results across different limits for the same query", () => {
    resetAzureIconLibrary();
    const a = searchAzureIcons("storage", 3);
    const b = searchAzureIcons("storage", 5);
    assert(a.length <= 3);
    assert(b.length <= 5);
    // Smaller result set should be a prefix of the larger one
    assertEquals(a, b.slice(0, a.length), "Smaller limit should be a prefix of larger");
  });

  it("cache is case-insensitive on query text", () => {
    resetAzureIconLibrary();
    const lower = searchAzureIcons("virtual machine", 5);
    const upper = searchAzureIcons("Virtual Machine", 5);
    assertEquals(lower, upper, "Expected cache hit regardless of casing");
  });

  it("cache is cleared on resetAzureIconLibrary", () => {
    const beforeReset = searchAzureIcons("storage", 5);
    resetAzureIconLibrary();
    const afterReset = searchAzureIcons("storage", 5);
    assert(beforeReset !== afterReset, "Expected fresh results after reset");
    assertEquals(beforeReset.length, afterReset.length);
  });

  it("evicts cache when max size is exceeded", () => {
    resetAzureIconLibrary();
    const originalMax = getSearchCacheSize();
    setMaxSearchCacheSize(2);
    try {
      // Fill cache with 2 entries (at capacity)
      searchAzureIcons("storage", 5);
      searchAzureIcons("virtual machine", 5);
      // Third distinct query should trigger eviction
      searchAzureIcons("network", 5);
      // After eviction and re-add, cache should have 1 entry
      // Verify the cache still works (no crash, returns results)
      const result = searchAzureIcons("network", 5);
      assert(result.length > 0, "Expected results after cache eviction");
    } finally {
      setMaxSearchCacheSize(originalMax);
      resetAzureIconLibrary();
    }
  });
});

describe("getAzureShapeByName", () => {
  it("finds shape by exact title (case insensitive)", () => {
    const first = library.shapes[0];
    const found = getAzureShapeByName(first.title);
    assertExists(found);
    assertEquals(found!.title, first.title);
  });

  it("finds shape by id", () => {
    const first = library.shapes[0];
    const found = getAzureShapeByName(first.id);
    assertExists(found);
  });

  it("returns undefined for unknown name", () => {
    assertEquals(getAzureShapeByName("does-not-exist-at-all"), undefined);
  });

  it("resolves alias when direct lookup fails", () => {
    const found = getAzureShapeByName("Container Apps");
    assertExists(found);
    assert(found!.title.includes("Container-Apps-Environments"));
  });

  it("resolves Entra ID alias", () => {
    const found = getAzureShapeByName("Entra ID");
    assertExists(found);
    assert(found!.title.includes("Entra-ID"));
  });

  it("resolves Azure Monitor alias", () => {
    const found = getAzureShapeByName("Azure Monitor");
    assertExists(found);
    assert(found!.title.includes("Azure-Monitor-Dashboard"));
  });

  it("resolves Front Doors alias", () => {
    const found = getAzureShapeByName("Front Doors");
    assertExists(found);
    assert(found!.title.includes("Front-Door-and-CDN-Profiles"));
  });

  it("resolves Azure Front Door alias variant", () => {
    const found = getAzureShapeByName("Azure Front Door");
    assertExists(found);
    assert(found!.title.includes("Front-Door-and-CDN-Profiles"));
  });

  it("resolves alias case-insensitively", () => {
    const found = getAzureShapeByName("CONTAINER APPS");
    assertExists(found);
    assert(found!.title.includes("Container-Apps-Environments"));
  });
});

describe("setAzureIconLibraryPath", () => {
  it("updates the configured library path", () => {
    const customPath = "/tmp/custom-icons.xml";
    setAzureIconLibraryPath(customPath);
    resetAzureIconLibrary();
    // Restore default path so other tests are unaffected
    setAzureIconLibraryPath(resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"));
    resetAzureIconLibrary();
    const lib = getAzureIconLibrary();
    assert(lib.shapes.length > 0);
  });
});

describe("resetAzureIconLibrary", () => {
  it("clears cached library and search index", () => {
    const lib1 = getAzureIconLibrary();
    assert(lib1.shapes.length > 0);
    resetAzureIconLibrary();
    const lib2 = getAzureIconLibrary();
    assert(lib2.shapes.length > 0);
    assert(lib2 !== lib1);
  });

  it("search still works after reset", () => {
    resetAzureIconLibrary();
    const results = searchAzureIcons("virtual machine", 5);
    assert(results.length > 0);
  });
});

describe("initializeShapes", () => {
  afterEach(() => {
    // Restore the default path so other tests are unaffected
    setAzureIconLibraryPath(resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"));
    resetAzureIconLibrary();
  });

  it("loads library eagerly and returns it", () => {
    resetAzureIconLibrary();
    const lib = initializeShapes();
    assert(lib.shapes.length > 0);
    assert(lib.categories.size > 0);
  });

  it("accepts a custom library path", () => {
    const validPath = resolve("assets/azure-public-service-icons/000 all azure public service icons.xml");
    const lib = initializeShapes(validPath);
    assert(lib.shapes.length > 0);
  });

  it("returns empty library for non-existent path", () => {
    const lib = initializeShapes("/non/existent/path.xml");
    assertEquals(lib.shapes.length, 0);
    assertEquals(lib.categories.size, 0);
  });

  it("subsequent getAzureIconLibrary returns the same pre-loaded instance", () => {
    const lib1 = initializeShapes();
    const lib2 = getAzureIconLibrary();
    assert(lib2 === lib1);
  });

  it("replaces a previously cached library", () => {
    const lib1 = initializeShapes();
    const lib2 = initializeShapes();
    assert(lib2 !== lib1);
    assertEquals(lib2.shapes.length, lib1.shapes.length);
  });
});

describe("getAzureIconLibrary automatic reload", () => {
  afterEach(() => {
    // Restore the default path so other tests are unaffected
    setAzureIconLibraryPath(resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"));
    resetAzureIconLibrary();
  });

  it("reloads when cached library has zero shapes after path change", () => {
    initializeShapes("/non/existent/path.xml");
    const emptyLib = getAzureIconLibrary();
    assertEquals(emptyLib.shapes.length, 0);
    const validPath = resolve("assets/azure-public-service-icons/000 all azure public service icons.xml");
    setAzureIconLibraryPath(validPath);
    const reloadedLib = getAzureIconLibrary();
    assert(reloadedLib.shapes.length > 0);
  });

  it("search works after automatic reload from empty cache", () => {
    initializeShapes("/non/existent/path.xml");
    assertEquals(getAzureIconLibrary().shapes.length, 0);
    const validPath = resolve("assets/azure-public-service-icons/000 all azure public service icons.xml");
    setAzureIconLibraryPath(validPath);
    const results = searchAzureIcons("virtual machine", 5);
    assert(results.length > 0);
  });
});

describe("resolveAzureAlias", () => {
  it("returns primary target for known alias", () => {
    assertEquals(resolveAzureAlias("Container Apps"), "02989-icon-service-container-apps-environments");
  });

  it("is case-insensitive", () => {
    assertEquals(resolveAzureAlias("ENTRA ID"), "10231-icon-service-entra-id-protection");
    assertEquals(resolveAzureAlias("entra id"), "10231-icon-service-entra-id-protection");
  });

  it("returns undefined for unknown query", () => {
    assertEquals(resolveAzureAlias("not an alias"), undefined);
  });

  it("resolves Azure Container Apps variant", () => {
    assertEquals(resolveAzureAlias("Azure Container Apps"), "02989-icon-service-container-apps-environments");
  });

  it("resolves Microsoft Entra ID variant", () => {
    assertEquals(resolveAzureAlias("Microsoft Entra ID"), "10231-icon-service-entra-id-protection");
  });

  it("resolves Azure Monitor", () => {
    assertEquals(resolveAzureAlias("Azure Monitor"), "02488-icon-service-azure-monitor-dashboard");
  });

  it("resolves Front Doors and variants", () => {
    assertEquals(resolveAzureAlias("Front Doors"), "10073-icon-service-front-door-and-cdn-profiles");
    assertEquals(resolveAzureAlias("Azure Front Door"), "10073-icon-service-front-door-and-cdn-profiles");
    assertEquals(resolveAzureAlias("Azure Front Doors"), "10073-icon-service-front-door-and-cdn-profiles");
  });

  it("resolves App Service", () => {
    assertEquals(resolveAzureAlias("App Service"), "10035-icon-service-app-services");
  });

  it("resolves Static Web App variants", () => {
    assertEquals(resolveAzureAlias("Static Web App"), "01007-icon-service-static-apps");
    assertEquals(resolveAzureAlias("Static Web Apps"), "01007-icon-service-static-apps");
  });

  it("resolves Azure Functions", () => {
    assertEquals(resolveAzureAlias("Azure Functions"), "10029-icon-service-function-apps");
  });

  it("resolves abbreviations (ACR, VM, VNet, NSG, AKS, APIM)", () => {
    assertEquals(resolveAzureAlias("ACR"), "10105-icon-service-container-registries");
    assertEquals(resolveAzureAlias("VM"), "10021-icon-service-virtual-machine");
    assertEquals(resolveAzureAlias("VNet"), "10061-icon-service-virtual-networks");
    assertEquals(resolveAzureAlias("NSG"), "10067-icon-service-network-security-groups");
    assertEquals(resolveAzureAlias("AKS"), "10023-icon-service-kubernetes-services");
    assertEquals(resolveAzureAlias("APIM"), "10042-icon-service-api-management-services");
  });

  it("resolves Blob Storage", () => {
    assertEquals(resolveAzureAlias("Blob Storage"), "10780-icon-service-blob-block");
  });

  it("resolves Redis Cache", () => {
    assertEquals(resolveAzureAlias("Redis Cache"), "10137-icon-service-cache-redis");
  });

  it("resolves Azure Firewall", () => {
    assertEquals(resolveAzureAlias("Azure Firewall"), "10084-icon-service-firewalls");
  });

  it("resolves Azure DNS", () => {
    assertEquals(resolveAzureAlias("Azure DNS"), "10064-icon-service-dns-zones");
  });

  it("resolves Azure SQL Database", () => {
    assertEquals(resolveAzureAlias("Azure SQL Database"), "10130-icon-service-sql-database");
  });

  it("resolves Managed Identity", () => {
    assertEquals(resolveAzureAlias("Managed Identity"), "10227-icon-service-entra-managed-identities");
  });

  it("resolves App Insights", () => {
    assertEquals(resolveAzureAlias("App Insights"), "00012-icon-service-application-insights");
  });

  it("resolves Cosmos DB variants", () => {
    assertEquals(resolveAzureAlias("Cosmos DB"), "10121-icon-service-azure-cosmos-db");
    assertEquals(resolveAzureAlias("CosmosDB"), "10121-icon-service-azure-cosmos-db");
  });

  it("resolves Bastion", () => {
    assertEquals(resolveAzureAlias("Bastion"), "02422-icon-service-bastions");
  });

  it("resolves ExpressRoute variants", () => {
    assertEquals(resolveAzureAlias("ExpressRoute"), "10079-icon-service-expressroute-circuits");
    assertEquals(resolveAzureAlias("Express Route"), "10079-icon-service-expressroute-circuits");
  });
});

describe("resolveAllAzureAliases", () => {
  it("returns all targets for multi-target alias", () => {
    const targets = resolveAllAzureAliases("Container Apps");
    assertExists(targets);
    assertEquals(targets!.length, 2);
    assertEquals(targets![0], "02989-icon-service-container-apps-environments");
    assertEquals(targets![1], "02884-icon-service-worker-container-app");
  });

  it("returns single-element array for single-target alias", () => {
    const targets = resolveAllAzureAliases("Entra ID");
    assertExists(targets);
    assertEquals(targets!.length, 1);
    assertEquals(targets![0], "10231-icon-service-entra-id-protection");
  });

  it("returns undefined for unknown query", () => {
    assertEquals(resolveAllAzureAliases("not an alias"), undefined);
  });

  it("is case-insensitive", () => {
    const lower = resolveAllAzureAliases("container apps");
    const upper = resolveAllAzureAliases("Container Apps");
    assertEquals(lower, upper);
  });
});

describe("AZURE_SHAPE_ALIASES", () => {
  it("all alias targets exist in the icon library", () => {
    const lib = getAzureIconLibrary();
    for (const [_alias, targets] of AZURE_SHAPE_ALIASES) {
      for (const target of targets) {
        const found = lib.indexByTitle.get(target);
        assertExists(found, `Alias target '${target}' not found in indexByTitle`);
      }
    }
  });

  it("contains expected aliases", () => {
    // App Service / Web Apps
    assertEquals(AZURE_SHAPE_ALIASES.has("app service"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure app service"), true);

    // Static Web Apps
    assertEquals(AZURE_SHAPE_ALIASES.has("static web app"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("static web apps"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure static web app"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure static web apps"), true);

    // Functions
    assertEquals(AZURE_SHAPE_ALIASES.has("azure functions"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("function app"), true);

    // Container Apps
    assertEquals(AZURE_SHAPE_ALIASES.has("container apps"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure container apps"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("container app"), true);

    // Container Registry
    assertEquals(AZURE_SHAPE_ALIASES.has("container registry"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("acr"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure container registry"), true);

    // AKS
    assertEquals(AZURE_SHAPE_ALIASES.has("aks"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure kubernetes service"), true);

    // Virtual Machines
    assertEquals(AZURE_SHAPE_ALIASES.has("vm"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("virtual machines"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure vm"), true);

    // Virtual Networks
    assertEquals(AZURE_SHAPE_ALIASES.has("vnet"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure vnet"), true);

    // NSG
    assertEquals(AZURE_SHAPE_ALIASES.has("nsg"), true);

    // Blob Storage
    assertEquals(AZURE_SHAPE_ALIASES.has("blob storage"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure blob storage"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("blob"), true);

    // Storage Accounts
    assertEquals(AZURE_SHAPE_ALIASES.has("storage account"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("storage accounts"), true);

    // Redis
    assertEquals(AZURE_SHAPE_ALIASES.has("redis cache"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("redis"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure cache for redis"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure redis"), true);

    // Firewall
    assertEquals(AZURE_SHAPE_ALIASES.has("azure firewall"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("firewall"), true);

    // DNS
    assertEquals(AZURE_SHAPE_ALIASES.has("azure dns"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("dns"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("private dns"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("private dns zone"), true);

    // SQL
    assertEquals(AZURE_SHAPE_ALIASES.has("azure sql database"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure sql"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("sql database"), true);

    // Managed Identity
    assertEquals(AZURE_SHAPE_ALIASES.has("managed identity"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("managed identities"), true);

    // Application Insights
    assertEquals(AZURE_SHAPE_ALIASES.has("app insights"), true);

    // Entra ID
    assertEquals(AZURE_SHAPE_ALIASES.has("entra id"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("microsoft entra id"), true);

    // Azure Monitor
    assertEquals(AZURE_SHAPE_ALIASES.has("azure monitor"), true);

    // Front Doors
    assertEquals(AZURE_SHAPE_ALIASES.has("front doors"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("front door"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure front door"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure front doors"), true);

    // Cosmos DB
    assertEquals(AZURE_SHAPE_ALIASES.has("cosmos db"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("cosmosdb"), true);

    // Key Vault
    assertEquals(AZURE_SHAPE_ALIASES.has("key vault"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure key vault"), true);

    // Service Bus
    assertEquals(AZURE_SHAPE_ALIASES.has("service bus"), true);

    // API Management
    assertEquals(AZURE_SHAPE_ALIASES.has("api management"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("apim"), true);

    // Application Gateway
    assertEquals(AZURE_SHAPE_ALIASES.has("app gateway"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("application gateway"), true);

    // Load Balancer
    assertEquals(AZURE_SHAPE_ALIASES.has("load balancer"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure load balancer"), true);

    // Log Analytics
    assertEquals(AZURE_SHAPE_ALIASES.has("log analytics"), true);

    // Bastion
    assertEquals(AZURE_SHAPE_ALIASES.has("bastion"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure bastion"), true);

    // ExpressRoute
    assertEquals(AZURE_SHAPE_ALIASES.has("expressroute"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("express route"), true);
  });

  it("values are non-empty arrays", () => {
    for (const [alias, targets] of AZURE_SHAPE_ALIASES) {
      assert(Array.isArray(targets), `Alias '${alias}' should map to an array`);
      assert(targets.length > 0, `Alias '${alias}' should have at least one target`);
    }
  });
});

describe("displayTitle", () => {
  it("strips numeric prefix and icon-service- boilerplate", () => {
    assertEquals(displayTitle("02989-icon-service-Container-Apps-Environments"), "Container Apps Environments");
  });

  it("converts hyphens to spaces in the name portion", () => {
    assertEquals(displayTitle("02884-icon-service-Worker-Container-App"), "Worker Container App");
  });

  it("handles Entra ID titles", () => {
    assertEquals(displayTitle("10231-icon-service-Entra-ID-Protection"), "Entra ID Protection");
  });

  it("handles titles without the prefix gracefully", () => {
    assertEquals(displayTitle("Some-Random-Title"), "Some Random Title");
  });

  it("handles empty string", () => {
    assertEquals(displayTitle(""), "");
  });

  it("handles title with only prefix", () => {
    assertEquals(displayTitle("00001-icon-service-"), "");
  });
});

describe("indexByTitle includes display names", () => {
  it("finds shape by display-friendly name", () => {
    const found = getAzureShapeByName("Container Apps Environments");
    assertExists(found);
    assert(found!.title.includes("Container-Apps-Environments"));
  });

  it("finds shape by display-friendly name case-insensitively", () => {
    const found = getAzureShapeByName("container apps environments");
    assertExists(found);
    assert(found!.title.includes("Container-Apps-Environments"));
  });

  it("still finds shape by raw title", () => {
    const found = getAzureShapeByName("02989-icon-service-Container-Apps-Environments");
    assertExists(found);
    assert(found!.title.includes("Container-Apps-Environments"));
  });
});
