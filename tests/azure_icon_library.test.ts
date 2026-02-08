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

  it("alias respects limit parameter", () => {
    const results = searchAzureIcons("Container Apps", 2);
    assert(results.length <= 2);
  });

  it("returns cached results for repeated identical queries", () => {
    resetAzureIconLibrary();
    const first = searchAzureIcons("virtual machine", 5);
    const second = searchAzureIcons("virtual machine", 5);
    assert(first === second, "Expected same array reference from cache");
  });

  it("cache distinguishes different limits for the same query", () => {
    resetAzureIconLibrary();
    const a = searchAzureIcons("storage", 3);
    const b = searchAzureIcons("storage", 5);
    assert(a !== b, "Different limits should produce separate cache entries");
    assert(a.length <= 3);
    assert(b.length <= 5);
  });

  it("cache is case-insensitive on query text", () => {
    resetAzureIconLibrary();
    const lower = searchAzureIcons("virtual machine", 5);
    const upper = searchAzureIcons("Virtual Machine", 5);
    assert(lower === upper, "Expected cache hit regardless of casing");
  });

  it("cache is cleared on resetAzureIconLibrary", () => {
    const beforeReset = searchAzureIcons("storage", 5);
    resetAzureIconLibrary();
    const afterReset = searchAzureIcons("storage", 5);
    assert(beforeReset !== afterReset, "Expected fresh results after reset");
    assertEquals(beforeReset.length, afterReset.length);
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
    assertEquals(AZURE_SHAPE_ALIASES.has("container apps"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("entra id"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("microsoft entra id"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure container apps"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure monitor"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("front doors"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure front door"), true);
    assertEquals(AZURE_SHAPE_ALIASES.has("azure front doors"), true);
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
