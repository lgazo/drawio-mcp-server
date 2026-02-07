/**
 * Azure Icon Library Loader
 * Loads and parses the complete Azure architecture icons from the dwarfered repository
 * https://github.com/dwarfered/azure-architecture-icons-for-drawio
 */

import * as fs from "fs";
import * as path from "path";
import FuzzySearch from "fuzzy-search";
import { esmDirname } from "../utils.js";

// ESM __dirname via shared utility
const __dirname = esmDirname(import.meta.url);

export interface AzureIconShape {
  id: string;
  title: string;
  width: number;
  height: number;
  xml: string; // Full mxGraphModel XML
  style?: string; // Draw.io style string (if extracted)
  category?: string; // Azure service category (e.g., "Compute", "Networking")
}

export interface AzureIconLibrary {
  shapes: AzureIconShape[];
  categories: Map<string, AzureIconShape[]>;
  indexByTitle: Map<string, AzureIconShape>;
}

/**
 * Parse the Azure icon library XML file
 * The library format is: <mxlibrary>[{xml, title, ...}, ...]</mxlibrary>
 */
function parseLibraryXml(xmlContent: string): AzureIconShape[] {
  try {
    // Extract JSON array from mxlibrary XML
    const match = xmlContent.match(/<mxlibrary>\[(.*)\]<\/mxlibrary>/s);
    if (!match) {
      console.warn("No mxlibrary found in XML");
      return [];
    }

    const jsonStr = "[" + match[1] + "]";
    const parsed = JSON.parse(jsonStr) as any[];

    return parsed.map((item, index) => {
      // Decode the embedded XML if it's URL-encoded
      let xml = item.xml || "";
      if (xml.startsWith("&lt;")) {
        xml = xml
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&");
      }

      // Sanitize title - remove null bytes and extra whitespace
      const rawTitle = (item.title || `shape-${index}`).trim();
      const title = rawTitle.replace(/[^\x20-\x7E]/g, "").trim() || `shape-${index}`;

      // Generate a safe ID from the title
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || `shape-${index}`;

      return {
        id,
        title,
        width: item.w || 48,
        height: item.h || 48,
        xml,
        style: extractStyle(xml),
      };
    });
  } catch (error) {
    console.error("Error parsing library XML:", error);
    return [];
  }
}

/**
 * Extract style string from embedded SVG data URL in the XML
 * The XML contains image attributes with base64-encoded SVG data
 */
function extractStyle(xml: string): string | undefined {
  // Look for image data in the style attribute
  // Pattern: style="...image=data:image/svg+xml,[encoded]..."
  const match = xml.match(/image=(data:image\/svg\+xml[^;")]*)/);

  if (match) {
    const imageData = match[1];
    // Build a style string that includes the image as a data URL
    // with proper escaping for use in Draw.io
    const style = `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=${imageData}`;
    return style;
  }
  return undefined;
}

/**
 * Categorize icons based on their title patterns.
 * Titles from the XML library are prefixed with numbering and "icon-service-"
 * (e.g., "00030-icon-service-Machine-Learning-Studio-(Classic)-Web-Services"),
 * so we strip that prefix and normalize hyphens before applying regex rules.
 */
function categorizeShapes(shapes: AzureIconShape[]): Map<string, AzureIconShape[]> {
  const categories = new Map<string, AzureIconShape[]>();

  const categoryKeywords: Record<string, RegExp> = {
    "AI + Machine Learning": /^(cognitive|bot|openai|azure openai|machine learning|text|speech|vision|anomaly|ai |ai$|language|qna|translator|immersive|form recognizer|personalizer|content moderator|content safety|bonsai|azure applied ai|azure experimentation|azure object understanding|metrics advisor|serverless search|genomic|computer vision|custom vision|face api)/i,
    Analytics: /^(synapse|azure synapse|databricks|azure databricks|data factory|data factories|stream analytics|event hub|analysis service|data lake|data catalog|azure data catalog|data share|data virtualization|power bi|hd insight|hdi aks|time series|azure data explorer|endpoint analytics|internet analyzer)/i,
    "Blockchain": /^(blockchain|consortium|azure blockchain)/i,
    Compute: /^(virtual machine|vm |vm$|batch|cloud service|availability set|host group|host pool|hosts$|compute fleet|spot vm|auto scale|automanaged|capacity reservation|image|os image|disk|ssd|proximity placement|restore point|scale set|azure compute galler|community image|bare metal|modular data center|avs vm|server farm|shared image)/i,
    Containers: /^(container|aks|kubernetes|registry|docker|azure red hat openshift|azure spring|worker container)/i,
    Databases: /^(sql|azure sql|mysql|mariadb|postgresql|cosmos|azure cosmos|cache|redis|azure managed redis|database|azure database|elastic pool|elastic job|managed instance|managed database|instance pool|oracle|production ready|virtual cluster|dedicated hsm)/i,
    "Developer Tools": /^(app configuration|connection$|connections$|extension$|extensions$|on premises data|service provider|service fabric|managed service fabric|software as a service)/i,
    DevOps: /^(azure devops|devops|devtest|pipeline|repo|artifact|backlog|branch|build|bug|commit|code$|code |test base|lab account|lab service|cloudtest|managed devops|microsoft dev box|azure deployment environment|azure dev tunnel|tfs vc|workspace gateway|workspaces$|load test)/i,
    General: /^(resource|subscription|management group|management portal|all resource|tag|template|quickstart|help|learn|marketplace|advisor|dashboard|portal|launch|recent|download|free service|information|guide|gear|toolbox|powershell|azure a$|azure workbook|workbook|location|search$|search |preview|feature|user setting|user privacy|user subscription|tenant|offer|plan$|plans$|region management|azure cloud shell|azure token|azure sustainability|azure consumption|azure lighthouse|my customer|education|ebook|heart|power$|power |power up|solutions|sonic dash|troubleshoot|versions|workflow|service catalog|service group|abs member|030777508|ceres|breeze|fiji|mindaro|aquila|planetary|process explorer|input output|cubes|counter|controls|browser|dev console|error$|globe|folder|file$|files$|ftp|module|log streaming|alerts$|metrics$|frd qa|journey hub|azurite|promethus)/i,
    "Health": /^(fhir|azure api for fhir|medtech|genomic account)/i,
    "Hybrid + Multicloud": /^(azure stack|stack hci|hybrid|arc |arc$|machinesazurearc|azure arc|landing zone|mission landing|azure hybrid|azure vmware|scvmm|wac$|wac |azure edge hardware|edge action|edge management)/i,
    Identity: /^(active directory|entra|access|conditional access|identity|app registration|enterprise app|external id|managed identit|multi.?factor|multi tenancy|administrative unit|groups$|users$|azure ad|verifiable credential|verification as|exchange access|exchange on premises)/i,
    Integration: /^(service bus|azure service bus|logic app|api management|api connection|api center|api proxy|event grid|integration|relay|notification hub|sendgrid|signalr|biz talk|collaborative|data collection|system topic|partner namespace|partner registration|partner topic|open supply chain|business process|engage center|azure communication|azure programmable)/i,
    "Intune + Endpoint Management": /^(intune|client app|software update)/i,
    IoT: /^(iot|device provisioning|device update|digital twin|azure sphere|connected vehicle|industrial iot|azure iot|rtos|connected cache|defender (cm|dcs|distribut|engineering|external|freezer|hmi|historian|industrial|marquee|meter|plc|pneumatic|programable|rtu|relay|robot|sensor|slot|web guiding)|device compliance|device configuration|device enrollment|device security|devices$)/i,
    "Management + Governance": /^(monitor|azure monitor|log analytics|automation|policy|backup|recovery|cost|blueprint|compliance|app compliance|diagnostic|activity log|change analysis|service health|update|maintenance|azure chaos|azure backup|resource guard|resource mover|resource graph|managed desktop|managed application|operation log|azure support|savings|scheduler|reservation|reserved|azure quota|purview|azure purview|governance|azure managed grafana|targets management|toolchain|workload orchestration|osconfig|icm|infrastructure backup|application insight|applens|azure load testing)/i,
    Media: /^(media|video|azure media|azure video)/i,
    Migration: /^(azure migrate|migration|import export|storsimple|azure storage mover|ssis lift)/i,
    "Mixed Reality": /^(spatial anchor|remote rendering|mesh application)/i,
    Mobile: /^(mobile|app center)/i,
    Networking: /^(virtual network|load balancer|application gateway|vpn|firewall|azure firewall|dns|front door|cdn|traffic|network|bastion|expressroute|express route|local network|nat$|nat |ip address|ip group|ip prefix|public ip|private endpoint|private link|peering|route|subnet|ddos|virtual wan|virtual router|web application firewall|custom ip|outbound|atm multistack|azure network function|service endpoint polic)/i,
    "Operator": /^(azure operator|azure orbital)/i,
    "Power Platform": /^(power platform)/i,
    "SAP on Azure": /^(azure center for sap|central service instance|virtual instance for sap|azure monitors? for sap)/i,
    Security: /^(security|key vault|keys$|ssh key|sentinel|azure sentinel|defender(?! (cm|dcs|distribut|engineering|external|freezer|hmi|historian|industrial|marquee|meter|plc|pneumatic|programable|rtu|relay|robot|sensor|slot|web guiding))|microsoft defender|confidential|detonation|customer lockbox|azure information protection|azure(?: )?attestation|extended.?security|application security)/i,
    Storage: /^(storage|blob|file share|managed file|azure fileshare|azure netapp|data box|azure databox|disk pool|elastic san|edge storage|azure hcp cache|table$|capacity$)/i,
    "Virtual Desktop": /^(azure virtual desktop|virtual visits|virtual enclaves|application group)/i,
    Web: /^(web |app service|static app|function app|app space|web app|web job|web slot|web test|website|universal print|windows10|windows notification)/i,
    "Maps + Spatial": /^(azure maps)/i,
    "Azure HPC": /^(azure hpc)/i,
  };

  shapes.forEach((shape) => {
    // Strip the numeric prefix and "icon-service-" to get the meaningful name
    const cleanTitle = shape.title
      .replace(/^\d+-icon-service-/, "")
      .replace(/-/g, " ")
      .trim();

    let categorized = false;

    for (const [category, pattern] of Object.entries(categoryKeywords)) {
      if (pattern.test(cleanTitle)) {
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(shape);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      if (!categories.has("Other")) {
        categories.set("Other", []);
      }
      categories.get("Other")!.push(shape);
    }
  });

  return categories;
}

/**
 * Load and parse the Azure icon library
 */
export function loadAzureIconLibrary(libraryPath?: string): AzureIconLibrary {
  // Try multiple possible paths to locate the icon library
  const possiblePaths = [
    // ESM __dirname based path (from src/shapes/)
    path.join(__dirname, "..", "..", "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
    // From build/ directory
    path.join(__dirname, "..", "..", "..", "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
    // From project root (cwd)
    path.join(process.cwd(), "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
  ];

  const filePath = libraryPath || possiblePaths.find(p => fs.existsSync(p));

  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`Azure icon library not found. Tried paths:`, possiblePaths);
    console.warn(`Current working directory: ${process.cwd()}`);
    console.warn(`__dirname: ${__dirname}`);
    return {
      shapes: [],
      categories: new Map(),
      indexByTitle: new Map(),
    };
  }

  console.log(`Loading Azure icon library from: ${filePath}`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const shapes = parseLibraryXml(content);
    const categories = categorizeShapes(shapes);

    // Set category on each shape for downstream consumers
    for (const [category, categoryShapes] of categories) {
      for (const shape of categoryShapes) {
        shape.category = category;
      }
    }

    const indexByTitle = new Map<string, AzureIconShape>();
    shapes.forEach((shape) => {
      indexByTitle.set(shape.title.toLowerCase(), shape);
      indexByTitle.set(shape.id.toLowerCase(), shape);
    });

    return {
      shapes,
      categories,
      indexByTitle,
    };
  } catch (error) {
    console.error(`Error loading Azure icon library from ${filePath}:`, error);
    return {
      shapes: [],
      categories: new Map(),
      indexByTitle: new Map(),
    };
  }
}

/**
 * Get library from cache (singleton pattern)
 */
let cachedLibrary: AzureIconLibrary | null = null;
let cachedSearchIndex: FuzzySearch<SearchableShape> | null = null;
let configuredLibraryPath: string | undefined;

type SearchableShape = AzureIconShape & {
  searchTitle: string;
  searchId: string;
};

/**
 * Set a custom path for the Azure icon library file.
 * Must be called before the library is first loaded (i.e. before any tool call).
 */
export function setAzureIconLibraryPath(libraryPath: string): void {
  configuredLibraryPath = libraryPath;
}

export function getAzureIconLibrary(): AzureIconLibrary {
  if (!cachedLibrary || cachedLibrary.shapes.length === 0) {
    cachedLibrary = loadAzureIconLibrary(configuredLibraryPath);
    cachedSearchIndex = null;
  }
  return cachedLibrary;
}

/**
 * Initialize the Azure icon library by loading shapes eagerly.
 * Call this at server startup to ensure shapes are available
 * before the first tool call.
 *
 * @param libraryPath Optional custom path to the icon library file.
 *                    When provided it replaces any previously configured path.
 * @returns The loaded library (may have zero shapes if the file is not found).
 */
export function initializeShapes(libraryPath?: string): AzureIconLibrary {
  if (libraryPath !== undefined) {
    configuredLibraryPath = libraryPath;
  }
  cachedLibrary = null;
  cachedSearchIndex = null;
  cachedLibrary = loadAzureIconLibrary(configuredLibraryPath);
  return cachedLibrary;
}

/**
 * Release the cached icon library and search index so memory can be reclaimed.
 * The next call to getAzureIconLibrary() will reload from disk.
 */
export function resetAzureIconLibrary(): void {
  cachedLibrary = null;
  cachedSearchIndex = null;
}

/**
 * Normalize text for fuzzy matching by removing boilerplate and punctuation.
 */
function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\d+-icon-service-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchIndex(): FuzzySearch<SearchableShape> {
  if (!cachedSearchIndex) {
    const library = getAzureIconLibrary();
    const searchableShapes: SearchableShape[] = library.shapes.map((shape) => ({
      ...shape,
      searchTitle: normalizeForSearch(shape.title),
      searchId: normalizeForSearch(shape.id),
    }));

    cachedSearchIndex = new FuzzySearch(searchableShapes, [
      "searchTitle",
      "searchId",
      "title",
      "id",
    ], {
      caseSensitive: false,
      sort: true,
    });
  }

  return cachedSearchIndex;
}

/**
 * Search result with confidence score
 */
export interface SearchResult extends AzureIconShape {
  score: number; // 0-1, higher = better match
}

/**
 * Search for icons by title or keyword with fuzzy matching.
 */
export function searchAzureIcons(
  query: string,
  limit = 10,
  _options?: { caseSensitive?: boolean }
): SearchResult[] {
  const searcher = getSearchIndex();
  const normalizedQuery = normalizeForSearch(query);
  let results = searcher.search(normalizedQuery).slice(0, limit);

  // Calculate confidence scores based on match position and query length
  const searchResults: SearchResult[] = results.map((item, index) => {
    const { searchTitle, searchId, ...shape } = item;
    // Score: 1.0 for exact match, decreases with position in results
    // Exact matches on title get boost
    const titleMatch = searchTitle === normalizedQuery ? 1.0 : 0;
    const idMatch = searchId === normalizedQuery ? 0.95 : 0;
    const positionDecay = 1 - index / results.length * 0.2; // Up to 20% decay
    const score = Math.max(titleMatch, idMatch) || 0.5 + 0.3 * positionDecay;

    return {
      ...shape,
      score: Math.min(1, Math.max(0, score)),
    };
  });

  return searchResults.sort((a, b) => b.score - a.score);
}

/**
 * Get all categories
 */
export function getAzureCategories(): string[] {
  const library = getAzureIconLibrary();
  return Array.from(library.categories.keys()).sort();
}

/**
 * Get shapes in a category
 */
export function getShapesInCategory(category: string): AzureIconShape[] {
  const library = getAzureIconLibrary();
  return library.categories.get(category) || [];
}

/**
 * Get a specific shape by title or ID
 */
export function getAzureShapeByName(name: string): AzureIconShape | undefined {
  const library = getAzureIconLibrary();
  return library.indexByTitle.get(name.toLowerCase());
}
