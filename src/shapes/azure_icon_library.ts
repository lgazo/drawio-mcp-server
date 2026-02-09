/**
 * Azure Icon Library Loader
 * Loads and parses the complete Azure architecture icons from the dwarfered repository
 * https://github.com/dwarfered/azure-architecture-icons-for-drawio
 *
 * Uses Deno-native APIs for filesystem access and `@std/path` for path manipulation.
 */

import { join } from "@std/path";
// @deno-types="npm:@types/fuzzy-search@2.1.5"
import FuzzySearch from "fuzzy-search";
import { esmDirname } from "../utils.ts";

// ESM __dirname via shared utility
const __dirname = esmDirname(import.meta.url);

/**
 * Check if a file exists at the given path (synchronous).
 * Avoids importing `@std/fs` for a single utility.
 */
function fileExistsSync(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

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
 * Regex patterns for categorizing Azure icons by title.
 * Compiled once at module level to avoid recompilation on each `categorizeShapes` call.
 */
const CATEGORY_KEYWORDS: Readonly<Record<string, RegExp>> = {
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

/**
 * Categorize icons based on their title patterns.
 * Titles from the XML library are prefixed with numbering and "icon-service-"
 * (e.g., "00030-icon-service-Machine-Learning-Studio-(Classic)-Web-Services"),
 * so we strip that prefix and normalize hyphens before applying regex rules.
 */
function categorizeShapes(shapes: AzureIconShape[]): Map<string, AzureIconShape[]> {
  const categories = new Map<string, AzureIconShape[]>();

  shapes.forEach((shape) => {
    // Strip the numeric prefix and "icon-service-" to get the meaningful name
    const cleanTitle = shape.title
      .replace(/^\d+-icon-service-/, "")
      .replace(/-/g, " ")
      .trim();

    let categorized = false;

    for (const [category, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
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
    join(__dirname, "..", "..", "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
    // From build/ directory
    join(__dirname, "..", "..", "..", "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
    // From project root (cwd)
    join(Deno.cwd(), "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
  ];

  const filePath = libraryPath || possiblePaths.find(p => fileExistsSync(p));

  if (!filePath || !fileExistsSync(filePath)) {
    console.warn(`Azure icon library not found. Tried paths:`, possiblePaths);
    console.warn(`Current working directory: ${Deno.cwd()}`);
    console.warn(`__dirname: ${__dirname}`);
    return {
      shapes: [],
      categories: new Map(),
      indexByTitle: new Map(),
    };
  }

  console.log(`Loading Azure icon library from: ${filePath}`);

  try {
    const content = Deno.readTextFileSync(filePath);
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
      // Also index by display-friendly name so lookups work with either form
      const friendly = displayTitle(shape.title).toLowerCase();
      if (!indexByTitle.has(friendly)) {
        indexByTitle.set(friendly, shape);
      }
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
 * Alias map for common Azure service names that don't have a dedicated icon
 * in the library. Keys are lowercased search terms; values are the lowercased
 * title of the icon to resolve to.
 *
 * The icon library may not include a standalone icon for every Azure service.
 * For example, "Container Apps" has no dedicated icon — only
 * "Container-Apps-Environments" and "Worker-Container-App" exist.
 * These aliases bridge the gap so that common searches resolve to the
 * best available icons automatically.
 *
 * Each alias maps to an **array** of target icon IDs. The first element
 * is the *primary* target used by `getAzureShapeByName` (single-shape
 * resolution), while `searchAzureIcons` injects **all** targets at the
 * top of the results list.
 */
export const AZURE_SHAPE_ALIASES: ReadonlyMap<string, readonly string[]> = new Map([
  // ── App Service / Web Apps ─────────────────────────────────────────────
  // "App Service" fuzzy-matches Plans/Certs/Domains before the main icon
  ["app service", ["10035-icon-service-app-services"]],
  ["azure app service", ["10035-icon-service-app-services"]],

  // ── Static Web Apps ────────────────────────────────────────────────────
  // Icon is named "Static-Apps", not "Static-Web-Apps"
  ["static web app", ["01007-icon-service-static-apps"]],
  ["static web apps", ["01007-icon-service-static-apps"]],
  ["azure static web app", ["01007-icon-service-static-apps"]],
  ["azure static web apps", ["01007-icon-service-static-apps"]],

  // ── Functions ──────────────────────────────────────────────────────────
  // "Azure Functions" fuzzy-matches Network Function Manager
  ["azure functions", ["10029-icon-service-function-apps"]],
  ["function app", ["10029-icon-service-function-apps"]],

  // ── Container Apps ─────────────────────────────────────────────────────
  ["container apps", ["02989-icon-service-container-apps-environments", "02884-icon-service-worker-container-app"]],
  ["azure container apps", ["02989-icon-service-container-apps-environments", "02884-icon-service-worker-container-app"]],
  ["container app", ["02989-icon-service-container-apps-environments", "02884-icon-service-worker-container-app"]],

  // ── Container Registry ─────────────────────────────────────────────────
  // Icon is titled "Container-Registries" (plural); singular/abbreviation miss
  ["container registry", ["10105-icon-service-container-registries"]],
  ["acr", ["10105-icon-service-container-registries"]],
  ["azure container registry", ["10105-icon-service-container-registries"]],

  // ── Kubernetes / AKS ───────────────────────────────────────────────────
  // "AKS" fuzzy-matches AKS Automatic; shorthand should resolve to the main icon
  ["aks", ["10023-icon-service-kubernetes-services"]],
  ["azure kubernetes service", ["10023-icon-service-kubernetes-services"]],

  // ── Virtual Machines ───────────────────────────────────────────────────
  // "VM" fuzzy-matches Automanaged VM; shorthand should resolve to main icon
  ["vm", ["10021-icon-service-virtual-machine"]],
  ["virtual machines", ["10021-icon-service-virtual-machine"]],
  ["azure vm", ["10021-icon-service-virtual-machine"]],

  // ── Virtual Networks ───────────────────────────────────────────────────
  // "VNet" does not fuzzy-match Virtual Networks at all
  ["vnet", ["10061-icon-service-virtual-networks"]],
  ["azure vnet", ["10061-icon-service-virtual-networks"]],

  // ── Network Security Groups ────────────────────────────────────────────
  // "NSG" fuzzy-matches HD Insight instead of Network Security Groups
  ["nsg", ["10067-icon-service-network-security-groups"]],

  // ── Blob Storage ───────────────────────────────────────────────────────
  // No "Blob Storage" icon; closest is Blob Block + Storage Accounts
  ["blob storage", ["10780-icon-service-blob-block", "10086-icon-service-storage-accounts"]],
  ["azure blob storage", ["10780-icon-service-blob-block", "10086-icon-service-storage-accounts"]],
  ["blob", ["10780-icon-service-blob-block"]],

  // ── Storage ────────────────────────────────────────────────────────────
  ["storage account", ["10086-icon-service-storage-accounts"]],
  ["storage accounts", ["10086-icon-service-storage-accounts"]],

  // ── Redis / Cache ──────────────────────────────────────────────────────
  // Icons are "Cache-Redis" and "Azure-Managed-Redis"; common names don't match
  ["redis cache", ["10137-icon-service-cache-redis"]],
  ["redis", ["10137-icon-service-cache-redis", "03675-icon-service-azure-managed-redis"]],
  ["azure cache for redis", ["10137-icon-service-cache-redis"]],
  ["azure redis", ["10137-icon-service-cache-redis", "03675-icon-service-azure-managed-redis"]],

  // ── Azure Firewall ─────────────────────────────────────────────────────
  // "Azure Firewall" fuzzy-matches Manager/Policy, not the main Firewalls icon
  ["azure firewall", ["10084-icon-service-firewalls"]],
  ["firewall", ["10084-icon-service-firewalls"]],

  // ── DNS ────────────────────────────────────────────────────────────────
  // "Azure DNS" fuzzy-matches Dev Tunnels; "Private DNS" returns Private Endpoints
  ["azure dns", ["10064-icon-service-dns-zones"]],
  ["dns", ["10064-icon-service-dns-zones"]],
  ["private dns", ["02882-icon-service-dns-private-resolver", "10064-icon-service-dns-zones"]],
  ["private dns zone", ["02882-icon-service-dns-private-resolver"]],

  // ── SQL Database ───────────────────────────────────────────────────────
  // "Azure SQL Database" fuzzy-matches Stretch Databases instead of SQL Database
  ["azure sql database", ["10130-icon-service-sql-database"]],
  ["azure sql", ["02390-icon-service-azure-sql", "10130-icon-service-sql-database"]],
  ["sql database", ["10130-icon-service-sql-database"]],

  // ── Managed Identity ───────────────────────────────────────────────────
  ["managed identity", ["10227-icon-service-entra-managed-identities"]],
  ["managed identities", ["10227-icon-service-entra-managed-identities"]],

  // ── Application Insights ───────────────────────────────────────────────
  // "App Insights" doesn't fuzzy-match — only full name does
  ["app insights", ["00012-icon-service-application-insights"]],

  // ── Entra ID ───────────────────────────────────────────────────────────
  ["entra id", ["10231-icon-service-entra-id-protection"]],
  ["microsoft entra id", ["10231-icon-service-entra-id-protection"]],

  // ── Azure Monitor ──────────────────────────────────────────────────────
  ["azure monitor", ["02488-icon-service-azure-monitor-dashboard"]],

  // ── Front Doors / CDN ──────────────────────────────────────────────────
  ["front doors", ["10073-icon-service-front-door-and-cdn-profiles"]],
  ["front door", ["10073-icon-service-front-door-and-cdn-profiles"]],
  ["azure front door", ["10073-icon-service-front-door-and-cdn-profiles"]],
  ["azure front doors", ["10073-icon-service-front-door-and-cdn-profiles"]],

  // ── Cosmos DB ──────────────────────────────────────────────────────────
  ["cosmos db", ["10121-icon-service-azure-cosmos-db"]],
  ["cosmosdb", ["10121-icon-service-azure-cosmos-db"]],

  // ── Key Vault ──────────────────────────────────────────────────────────
  ["key vault", ["10245-icon-service-key-vaults"]],
  ["azure key vault", ["10245-icon-service-key-vaults"]],

  // ── Service Bus ────────────────────────────────────────────────────────
  ["service bus", ["10836-icon-service-azure-service-bus"]],

  // ── API Management ─────────────────────────────────────────────────────
  ["api management", ["10042-icon-service-api-management-services"]],
  ["apim", ["10042-icon-service-api-management-services"]],

  // ── Application Gateway ────────────────────────────────────────────────
  ["app gateway", ["10076-icon-service-application-gateways"]],
  ["application gateway", ["10076-icon-service-application-gateways"]],

  // ── Load Balancer ──────────────────────────────────────────────────────
  ["load balancer", ["10062-icon-service-load-balancers"]],
  ["azure load balancer", ["10062-icon-service-load-balancers"]],

  // ── Log Analytics ──────────────────────────────────────────────────────
  ["log analytics", ["00009-icon-service-log-analytics-workspaces"]],

  // ── Bastion ────────────────────────────────────────────────────────────
  ["bastion", ["02422-icon-service-bastions"]],
  ["azure bastion", ["02422-icon-service-bastions"]],

  // ── ExpressRoute ───────────────────────────────────────────────────────
  ["expressroute", ["10079-icon-service-expressroute-circuits"]],
  ["express route", ["10079-icon-service-expressroute-circuits"]],
]);

/**
 * Resolve an alias to its **primary** (first) target icon ID.
 * Returns the lowercased target title when a match exists, otherwise
 * `undefined`. Used by `getAzureShapeByName` for single-shape resolution.
 */
export function resolveAzureAlias(query: string): string | undefined {
  const targets = AZURE_SHAPE_ALIASES.get(query.toLowerCase());
  return targets?.[0];
}

/**
 * Resolve an alias to **all** target icon IDs.
 * Returns `undefined` when the query is not an alias.
 * Used by `searchAzureIcons` to inject every aliased shape into results.
 */
export function resolveAllAzureAliases(query: string): readonly string[] | undefined {
  return AZURE_SHAPE_ALIASES.get(query.toLowerCase());
}

/**
 * Get library from cache (singleton pattern)
 */
let cachedLibrary: AzureIconLibrary | null = null;
let cachedSearchIndex: FuzzySearch<SearchableShape> | null = null;
let cachedSearchResults: Map<string, SearchResult[]> = new Map();
/** Maximum entries before the search cache is cleared and rebuilt on demand. */
let maxSearchCacheSize = 1_000;

/**
 * Override the maximum search-cache size. Intended for tests that need
 * to exercise the eviction branch without inserting thousands of entries.
 */
export function setMaxSearchCacheSize(size: number): void {
  maxSearchCacheSize = size;
}

/** Return the current number of entries in the search cache (for test assertions). */
export function getSearchCacheSize(): number {
  return cachedSearchResults.size;
}
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
    cachedSearchResults = new Map();
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
  cachedSearchResults = new Map();
  cachedCategoryNames = null;
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
  cachedSearchResults = new Map();
  cachedCategoryNames = null;
}

/**
 * Convert a raw Azure icon title (e.g. "02989-icon-service-Container-Apps-Environments")
 * into a human-friendly display name (e.g. "Container Apps Environments").
 * Strips the numeric prefix and "icon-service-" boilerplate, then converts
 * hyphens to spaces.
 */
export function displayTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^\d+-icon-service-/, "")
    .replace(/-/g, " ")
    .trim();
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
 * When the query matches an alias, the aliased icon is injected
 * at the top of results with a score of 1.0.
 */
/**
 * Build a cache key from the original query.
 * Uses the lowercased original query (not the normalized form) because
 * alias resolution depends on the original text.
 * The limit is excluded from the key — results are cached at maximum
 * depth and sliced to the requested limit on read.
 */
function searchCacheKey(query: string): string {
  return query.toLowerCase();
}

export function searchAzureIcons(
  query: string,
  limit = 10,
  _options?: { caseSensitive?: boolean }
): SearchResult[] {
  // Return cached results when available (library is immutable once loaded)
  const cacheKey = searchCacheKey(query);
  const cached = cachedSearchResults.get(cacheKey);
  if (cached) return cached.slice(0, limit);

  // Check aliases first — if matched, inject target(s) at the top of results
  const aliasTargets = resolveAllAzureAliases(query);
  const library = getAzureIconLibrary();
  const aliasShapes: AzureIconShape[] = aliasTargets
    ? aliasTargets
        .map(t => library.indexByTitle.get(t))
        .filter((s): s is AzureIconShape => s !== undefined)
    : [];

  const searcher = getSearchIndex();
  const normalizedQuery = normalizeForSearch(query);
  // Always fetch up to 50 results for caching — callers slice to their requested limit
  const maxCacheResults = 50;
  const results = searcher.search(normalizedQuery).slice(0, maxCacheResults);

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

  let finalResults: SearchResult[];

  // If aliases matched, inject them at the top (score 1.0) and
  // remove any duplicates of the same shapes from the fuzzy results.
  if (aliasShapes.length > 0) {
    const aliasIds = new Set(aliasShapes.map(s => s.id));
    const filtered = searchResults.filter(r => !aliasIds.has(r.id));
    const aliasResults: SearchResult[] = aliasShapes.map(s => ({ ...s, score: 1.0 }));
    finalResults = [...aliasResults, ...filtered].slice(0, maxCacheResults);
  } else {
    finalResults = searchResults.sort((a, b) => b.score - a.score);
  }

  // Evict search cache if it has grown too large
  if (cachedSearchResults.size >= maxSearchCacheSize) {
    cachedSearchResults.clear();
  }

  cachedSearchResults.set(cacheKey, finalResults);
  return finalResults.slice(0, limit);
}

/**
 * Get all categories (cached after first call).
 * Invalidated by `resetAzureIconLibrary` and `initializeShapes`.
 */
let cachedCategoryNames: string[] | null = null;

export function getAzureCategories(): string[] {
  if (!cachedCategoryNames) {
    const library = getAzureIconLibrary();
    cachedCategoryNames = Array.from(library.categories.keys()).sort();
  }
  return cachedCategoryNames;
}

/**
 * Get shapes in a category
 */
export function getShapesInCategory(category: string): AzureIconShape[] {
  const library = getAzureIconLibrary();
  return library.categories.get(category) || [];
}

/**
 * Get a specific shape by title or ID.
 * Falls back to alias resolution when no direct match is found.
 */
export function getAzureShapeByName(name: string): AzureIconShape | undefined {
  const library = getAzureIconLibrary();
  const direct = library.indexByTitle.get(name.toLowerCase());
  if (direct) return direct;

  // Check aliases
  const aliasTarget = resolveAzureAlias(name);
  if (aliasTarget) {
    return library.indexByTitle.get(aliasTarget);
  }

  return undefined;
}
