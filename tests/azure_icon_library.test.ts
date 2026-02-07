import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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
} from "../src/shapes/azure_icon_library.js";
import type { AzureIconLibrary } from "../src/shapes/azure_icon_library.js";

// Load library once for all tests
let library: AzureIconLibrary;

beforeAll(() => {
  library = loadAzureIconLibrary();
});

describe("loadAzureIconLibrary", () => {
  test("loads shapes from the XML file", () => {
    expect(library.shapes.length).toBeGreaterThan(0);
  });

  test("each shape has required fields", () => {
    for (const shape of library.shapes) {
      expect(shape.id).toBeTruthy();
      expect(shape.title).toBeTruthy();
      expect(shape.width).toBeGreaterThan(0);
      expect(shape.height).toBeGreaterThan(0);
      expect(shape.xml).toBeTruthy();
    }
  });

  test("builds indexByTitle for lookup", () => {
    expect(library.indexByTitle.size).toBeGreaterThan(0);
  });

  test("returns empty library for non-existent path", () => {
    const empty = loadAzureIconLibrary("/non/existent/path.xml");
    expect(empty.shapes).toHaveLength(0);
    expect(empty.categories.size).toBe(0);
    expect(empty.indexByTitle.size).toBe(0);
  });

  test("returns empty shapes when XML has no mxlibrary tag", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-no-mxlib-${Date.now()}.xml`);
    try {
      fs.writeFileSync(tmpFile, "<root><nothing/></root>", "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(0);
      expect(result.categories.size).toBe(0);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("returns empty shapes when mxlibrary contains invalid JSON", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-bad-json-${Date.now()}.xml`);
    try {
      fs.writeFileSync(tmpFile, "<mxlibrary>[{invalid json!}]</mxlibrary>", "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(0);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("returns empty library when path is a directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "drawio-test-dir-"));
    try {
      const result = loadAzureIconLibrary(tmpDir);
      expect(result.shapes).toHaveLength(0);
    } finally {
      fs.rmdirSync(tmpDir);
    }
  });

  test("handles shapes without image data URL in XML", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-no-image-${Date.now()}.xml`);
    const xmlContent = `<mxlibrary>[{"xml":"<mxGraphModel><root><mxCell style=\\"fillColor=#FF0000\\"/></root></mxGraphModel>","w":50,"h":50,"title":"No Image Shape"}]</mxlibrary>`;
    try {
      fs.writeFileSync(tmpFile, xmlContent, "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(1);
      expect(result.shapes[0].style).toBeUndefined();
      expect(result.shapes[0].title).toBe("No Image Shape");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("handles item with missing xml, title, width, and height", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-defaults-${Date.now()}.xml`);
    // Item with no xml, no title, no w, no h
    const xmlContent = `<mxlibrary>[{}]</mxlibrary>`;
    try {
      fs.writeFileSync(tmpFile, xmlContent, "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(1);
      expect(result.shapes[0].xml).toBe("");
      expect(result.shapes[0].title).toBe("shape-0");
      expect(result.shapes[0].id).toBe("shape-0");
      expect(result.shapes[0].width).toBe(48);
      expect(result.shapes[0].height).toBe(48);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("handles item with non-printable title falling back to shape-N", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-nonprint-${Date.now()}.xml`);
    // Title with only non-printable characters
    const xmlContent = `<mxlibrary>[{"title":"\\u0000\\u0001","w":10,"h":10}]</mxlibrary>`;
    try {
      fs.writeFileSync(tmpFile, xmlContent, "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(1);
      expect(result.shapes[0].title).toBe("shape-0");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("falls back to shape-N id when title sanitizes to empty id", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-emptyid-${Date.now()}.xml`);
    // Title "+++" is printable ASCII so title stays "+++", but ID sanitization
    // produces: "+++" → "---" → "-" → "" → falls back to "shape-0"
    const xmlContent = `<mxlibrary>[{"title":"+++","w":20,"h":20}]</mxlibrary>`;
    try {
      fs.writeFileSync(tmpFile, xmlContent, "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(1);
      expect(result.shapes[0].title).toBe("+++");
      expect(result.shapes[0].id).toBe("shape-0");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("handles item with URL-encoded XML (entity references)", () => {
    const tmpFile = path.join(os.tmpdir(), `drawio-test-encoded-${Date.now()}.xml`);
    const xmlContent = `<mxlibrary>[{"xml":"&lt;mxGraphModel&gt;&lt;root/&gt;&lt;/mxGraphModel&gt;","title":"Encoded","w":30,"h":30}]</mxlibrary>`;
    try {
      fs.writeFileSync(tmpFile, xmlContent, "utf-8");
      const result = loadAzureIconLibrary(tmpFile);
      expect(result.shapes).toHaveLength(1);
      expect(result.shapes[0].xml).toBe("<mxGraphModel><root/></mxGraphModel>");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe("categorizeShapes", () => {
  test("every shape is categorized (no Other category)", () => {
    const otherShapes = library.categories.get("Other") || [];
    expect(otherShapes).toHaveLength(0);
  });

  test("total categorized shapes equals total shapes", () => {
    let total = 0;
    for (const shapes of library.categories.values()) {
      total += shapes.length;
    }
    expect(total).toBe(library.shapes.length);
  });

  test("no shape object appears in more than one category", () => {
    const seen = new Set<object>();
    for (const [, shapes] of library.categories) {
      for (const shape of shapes) {
        expect(seen.has(shape)).toBe(false);
        seen.add(shape);
      }
    }
  });

  test("expected core categories exist", () => {
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
      expect(categories).toContain(cat);
    }
  });

  test("well-known shapes land in expected categories", () => {
    // Clean title helper mirrors the prefix-stripping in categorizeShapes
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
      expect(shapes).toBeDefined();
      for (const keyword of keywords) {
        const found = shapes!.some((s) => cleanTitle(s.title).includes(keyword));
        expect(found).toBe(true);
      }
    }
  });
});

describe("getAzureIconLibrary (cached singleton)", () => {
  test("returns same instance on repeated calls", () => {
    const a = getAzureIconLibrary();
    const b = getAzureIconLibrary();
    expect(a).toBe(b);
  });
});

describe("getAzureCategories", () => {
  test("returns sorted category names", () => {
    const categories = getAzureCategories();
    expect(categories.length).toBeGreaterThan(0);
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);
  });

  test("does not include Other", () => {
    const categories = getAzureCategories();
    expect(categories).not.toContain("Other");
  });
});

describe("getShapesInCategory", () => {
  test("returns shapes for a valid category", () => {
    const shapes = getShapesInCategory("Compute");
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes[0].title).toBeTruthy();
  });

  test("returns empty array for unknown category", () => {
    expect(getShapesInCategory("NonExistentCategory")).toEqual([]);
  });
});

describe("searchAzureIcons", () => {
  test("finds shapes matching a query", () => {
    const results = searchAzureIcons("virtual machine");
    expect(results.length).toBeGreaterThan(0);
  });

  test("respects limit parameter", () => {
    const results = searchAzureIcons("azure", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("returns shapes without internal search fields", () => {
    const results = searchAzureIcons("storage");
    for (const shape of results) {
      expect(shape).not.toHaveProperty("searchTitle");
      expect(shape).not.toHaveProperty("searchId");
    }
  });

  test("returns empty for gibberish query", () => {
    const results = searchAzureIcons("xyzzyqwerty12345");
    expect(results).toHaveLength(0);
  });

  test("exact title match gets score of 1.0", () => {
    const first = library.shapes[0];
    const results = searchAzureIcons(first.title, 10);
    const exactMatch = results.find(r => r.title === first.title);
    expect(exactMatch).toBeDefined();
    expect(exactMatch!.score).toBe(1.0);
  });

  test("exact id match gets high score", () => {
    const first = library.shapes[0];
    const results = searchAzureIcons(first.id, 10);
    const idMatch = results.find(r => r.id === first.id);
    expect(idMatch).toBeDefined();
    expect(idMatch!.score).toBeGreaterThanOrEqual(0.95);
  });

  test("alias query injects target as top result with score 1.0", () => {
    const results = searchAzureIcons("Container Apps", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Container-Apps-Environments");
    expect(results[0].score).toBe(1.0);
  });

  test("alias does not duplicate the target in results", () => {
    const results = searchAzureIcons("Container Apps", 10);
    const envResults = results.filter(r => r.title.includes("Container-Apps-Environments"));
    expect(envResults).toHaveLength(1);
  });

  test("Entra ID alias returns Entra ID Protection as top result", () => {
    const results = searchAzureIcons("Entra ID", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Entra-ID");
    expect(results[0].score).toBe(1.0);
  });

  test("Azure Monitor alias returns Azure Monitor Dashboard as top result", () => {
    const results = searchAzureIcons("Azure Monitor", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Azure-Monitor-Dashboard");
    expect(results[0].score).toBe(1.0);
  });

  test("Front Doors alias returns Front Door and CDN Profiles as top result", () => {
    const results = searchAzureIcons("Front Doors", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Front-Door-and-CDN-Profiles");
    expect(results[0].score).toBe(1.0);
  });

  test("alias respects limit parameter", () => {
    const results = searchAzureIcons("Container Apps", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe("getAzureShapeByName", () => {
  test("finds shape by exact title (case insensitive)", () => {
    const first = library.shapes[0];
    const found = getAzureShapeByName(first.title);
    expect(found).toBeDefined();
    expect(found!.title).toBe(first.title);
  });

  test("finds shape by id", () => {
    const first = library.shapes[0];
    const found = getAzureShapeByName(first.id);
    expect(found).toBeDefined();
  });

  test("returns undefined for unknown name", () => {
    expect(getAzureShapeByName("does-not-exist-at-all")).toBeUndefined();
  });

  test("resolves alias when direct lookup fails", () => {
    const found = getAzureShapeByName("Container Apps");
    expect(found).toBeDefined();
    expect(found!.title).toContain("Container-Apps-Environments");
  });

  test("resolves Entra ID alias", () => {
    const found = getAzureShapeByName("Entra ID");
    expect(found).toBeDefined();
    expect(found!.title).toContain("Entra-ID");
  });

  test("resolves Azure Monitor alias", () => {
    const found = getAzureShapeByName("Azure Monitor");
    expect(found).toBeDefined();
    expect(found!.title).toContain("Azure-Monitor-Dashboard");
  });

  test("resolves Front Doors alias", () => {
    const found = getAzureShapeByName("Front Doors");
    expect(found).toBeDefined();
    expect(found!.title).toContain("Front-Door-and-CDN-Profiles");
  });

  test("resolves Azure Front Door alias variant", () => {
    const found = getAzureShapeByName("Azure Front Door");
    expect(found).toBeDefined();
    expect(found!.title).toContain("Front-Door-and-CDN-Profiles");
  });

  test("resolves alias case-insensitively", () => {
    const found = getAzureShapeByName("CONTAINER APPS");
    expect(found).toBeDefined();
    expect(found!.title).toContain("Container-Apps-Environments");
  });
});

describe("setAzureIconLibraryPath", () => {
  test("updates the configured library path", () => {
    const customPath = "/tmp/custom-icons.xml";
    setAzureIconLibraryPath(customPath);
    // Reset so the next getAzureIconLibrary call uses the new path
    resetAzureIconLibrary();
    // Restore default path so other tests are unaffected
    setAzureIconLibraryPath(path.resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"));
    resetAzureIconLibrary();
    // Verify library still loads from the restored path
    const lib = getAzureIconLibrary();
    expect(lib.shapes.length).toBeGreaterThan(0);
  });
});

describe("resetAzureIconLibrary", () => {
  test("clears cached library and search index", () => {
    // Ensure cache is populated
    const lib1 = getAzureIconLibrary();
    expect(lib1.shapes.length).toBeGreaterThan(0);

    // Reset
    resetAzureIconLibrary();

    // After reset, getAzureIconLibrary reloads from disk (fresh instance)
    const lib2 = getAzureIconLibrary();
    expect(lib2.shapes.length).toBeGreaterThan(0);
    // lib2 should be a different instance than lib1
    expect(lib2).not.toBe(lib1);
  });

  test("search still works after reset", () => {
    resetAzureIconLibrary();
    // The search index must be rebuilt on next query
    const results = searchAzureIcons("virtual machine", 5);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("initializeShapes", () => {
  afterEach(() => {
    // Restore the default path so other tests are unaffected
    setAzureIconLibraryPath(path.resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"));
    resetAzureIconLibrary();
  });

  test("loads library eagerly and returns it", () => {
    resetAzureIconLibrary();
    const lib = initializeShapes();
    expect(lib.shapes.length).toBeGreaterThan(0);
    expect(lib.categories.size).toBeGreaterThan(0);
  });

  test("accepts a custom library path", () => {
    const validPath = path.resolve("assets/azure-public-service-icons/000 all azure public service icons.xml");
    const lib = initializeShapes(validPath);
    expect(lib.shapes.length).toBeGreaterThan(0);
  });

  test("returns empty library for non-existent path", () => {
    const lib = initializeShapes("/non/existent/path.xml");
    expect(lib.shapes).toHaveLength(0);
    expect(lib.categories.size).toBe(0);
  });

  test("subsequent getAzureIconLibrary returns the same pre-loaded instance", () => {
    const lib1 = initializeShapes();
    const lib2 = getAzureIconLibrary();
    expect(lib2).toBe(lib1);
  });

  test("replaces a previously cached library", () => {
    const lib1 = initializeShapes();
    const lib2 = initializeShapes();
    expect(lib2).not.toBe(lib1);
    expect(lib2.shapes.length).toBe(lib1.shapes.length);
  });
});

describe("getAzureIconLibrary automatic reload", () => {
  afterEach(() => {
    // Restore the default path so other tests are unaffected
    setAzureIconLibraryPath(path.resolve("assets/azure-public-service-icons/000 all azure public service icons.xml"));
    resetAzureIconLibrary();
  });

  test("reloads when cached library has zero shapes after path change", () => {
    // Load from a non-existent path → cached library is empty
    initializeShapes("/non/existent/path.xml");
    const emptyLib = getAzureIconLibrary();
    expect(emptyLib.shapes).toHaveLength(0);

    // Change path to a valid location
    const validPath = path.resolve("assets/azure-public-service-icons/000 all azure public service icons.xml");
    setAzureIconLibraryPath(validPath);

    // getAzureIconLibrary should detect empty shapes and reload from the new path
    const reloadedLib = getAzureIconLibrary();
    expect(reloadedLib.shapes.length).toBeGreaterThan(0);
  });

  test("search works after automatic reload from empty cache", () => {
    // Start with an empty library
    initializeShapes("/non/existent/path.xml");
    expect(getAzureIconLibrary().shapes).toHaveLength(0);

    // Fix the path
    const validPath = path.resolve("assets/azure-public-service-icons/000 all azure public service icons.xml");
    setAzureIconLibraryPath(validPath);

    // Searching should trigger a reload and return results
    const results = searchAzureIcons("virtual machine", 5);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("resolveAzureAlias", () => {
  test("returns target for known alias", () => {
    expect(resolveAzureAlias("Container Apps")).toBe("02989-icon-service-container-apps-environments");
  });

  test("is case-insensitive", () => {
    expect(resolveAzureAlias("ENTRA ID")).toBe("10231-icon-service-entra-id-protection");
    expect(resolveAzureAlias("entra id")).toBe("10231-icon-service-entra-id-protection");
  });

  test("returns undefined for unknown query", () => {
    expect(resolveAzureAlias("not an alias")).toBeUndefined();
  });

  test("resolves Azure Container Apps variant", () => {
    expect(resolveAzureAlias("Azure Container Apps")).toBe("02989-icon-service-container-apps-environments");
  });

  test("resolves Microsoft Entra ID variant", () => {
    expect(resolveAzureAlias("Microsoft Entra ID")).toBe("10231-icon-service-entra-id-protection");
  });

  test("resolves Azure Monitor", () => {
    expect(resolveAzureAlias("Azure Monitor")).toBe("02488-icon-service-azure-monitor-dashboard");
  });

  test("resolves Front Doors and variants", () => {
    expect(resolveAzureAlias("Front Doors")).toBe("10073-icon-service-front-door-and-cdn-profiles");
    expect(resolveAzureAlias("Azure Front Door")).toBe("10073-icon-service-front-door-and-cdn-profiles");
    expect(resolveAzureAlias("Azure Front Doors")).toBe("10073-icon-service-front-door-and-cdn-profiles");
  });
});

describe("AZURE_SHAPE_ALIASES", () => {
  test("all alias targets exist in the icon library", () => {
    const lib = getAzureIconLibrary();
    for (const [alias, target] of AZURE_SHAPE_ALIASES) {
      const found = lib.indexByTitle.get(target);
      expect(found).toBeDefined();
    }
  });

  test("contains expected aliases", () => {
    expect(AZURE_SHAPE_ALIASES.has("container apps")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("entra id")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("microsoft entra id")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("azure container apps")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("azure monitor")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("front doors")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("azure front door")).toBe(true);
    expect(AZURE_SHAPE_ALIASES.has("azure front doors")).toBe(true);
  });
});
