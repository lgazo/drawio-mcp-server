/**
 * Runtime shape extractor.
 *
 * Builds a throwaway dummy object inheriting `Sidebar.prototype`, overrides
 * the methods that drawio's vendor palette adders call, then invokes each
 * adder. Captures every (style, w, h, name, paletteId, sectionTitle) tuple
 * so the plugin can answer `get-shape-*` tools for vendors drawio ships
 * (AWS, GCP, Azure, Cisco19, CiscoSafe) without hand-curating the catalog.
 */

export type ExtractedShape = {
  style: string;
  width: number;
  height: number;
  name: string;
  paletteId: string;
  category: string;
};

const ADDER_TO_PALETTE: Record<string, string> = {
  addAWS4Palette: "aws4",
  addGCP2Palette: "gcp2",
  addAzure2Palette: "azure2",
  addCisco19Palette: "cisco19",
  addCiscoSafePalette: "cisco_safe",
};

export function extractShapesFromSidebar(
  ui: any,
): Map<string, ExtractedShape> {
  const Sidebar = (window as any).Sidebar;
  if (!Sidebar?.prototype) {
    throw new Error("drawio Sidebar prototype not available on window");
  }
  if (!ui?.sidebar) {
    throw new Error("ui.sidebar not constructed yet");
  }

  const recorded: ExtractedShape[] = [];
  let currentPalette = "unknown";
  let currentSection = "";

  const dummy: any = Object.assign(
    Object.create(Sidebar.prototype),
    ui.sidebar,
    {
      taglist: {},
      palettes: {},
      entries: [],

      createVertexTemplateEntry(
        style: string,
        w: number,
        h: number,
        _value: any,
        title: string,
      ) {
        recorded.push({
          style,
          width: w,
          height: h,
          name: String(title ?? ""),
          paletteId: currentPalette,
          category: `mxgraph.${currentPalette}.${slug(currentSection || "default")}`,
        });
        return () => null;
      },

      addPalette(
        _id: string,
        title: string,
        _expanded: boolean,
        onInit: (container: any) => void,
      ) {
        if (title) currentSection = title;
        try {
          onInit({ appendChild() {} });
        } catch {}
      },

      addPaletteFunctions(
        _id: string,
        title: string,
        _expanded: boolean,
        fns: Array<(container: any) => any>,
      ) {
        if (title) currentSection = title;
        const fake = { appendChild() {} };
        for (const fn of fns) {
          try {
            fn(fake);
          } catch {}
        }
      },

      setCurrentSearchEntryLibrary() {},

      createEdgeTemplateEntry: () => () => null,
      addEntry: (_tags: any, fn: any) => fn,
      createTitle: () =>
        typeof document !== "undefined"
          ? document.createElement("div")
          : ({} as any),
    },
  );

  for (const [adder, paletteId] of Object.entries(ADDER_TO_PALETTE)) {
    if (typeof dummy[adder] !== "function") {
      console.warn(
        `[shape-extractor] Sidebar.prototype.${adder} missing — vendor '${paletteId}' skipped`,
      );
      continue;
    }
    currentPalette = paletteId;
    currentSection = "";
    try {
      dummy[adder]();
    } catch (err) {
      console.warn(`[shape-extractor] ${adder} threw during extraction`, err);
    }
  }

  const out = new Map<string, ExtractedShape>();
  for (const s of recorded) {
    const key = deriveKey(s.style);
    if (key) out.set(key, s);
  }

  for (const v of Object.values(ADDER_TO_PALETTE)) {
    const n = [...out.keys()].filter((k) =>
      k.startsWith(`mxgraph.${v}.`),
    ).length;
    if (n === 0) {
      console.warn(`[shape-extractor] captured 0 shapes for vendor '${v}'`);
    }
  }

  return out;
}

function deriveKey(style: string): string | null {
  if (!style) return null;

  // 1) AWS4 resourceIcon: shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda
  const res = /resIcon=([^;]+)/.exec(style);
  if (res && res[1].startsWith("mxgraph.")) return res[1];

  // 2) Cisco19-style: shape=mxgraph.<vendor>.rect;prIcon=l2_switch
  const shapeMatch = /shape=mxgraph\.([a-z0-9_]+)\.([a-z0-9_]+)/i.exec(style);
  const prIconMatch = /prIcon=([a-z0-9_]+)/i.exec(style);
  if (shapeMatch && prIconMatch) {
    return `mxgraph.${shapeMatch[1].toLowerCase()}.${prIconMatch[1].toLowerCase()}`;
  }

  // 3) Direct shape=mxgraph.<vendor>.<icon>
  if (shapeMatch) {
    return `mxgraph.${shapeMatch[1].toLowerCase()}.${shapeMatch[2].toLowerCase()}`;
  }

  // 4) image-based: image=img/lib/<vendor>/<sub>/<file>.svg|png
  const imgMatch =
    /image=img\/lib\/([^/;]+)\/(?:(.+)\/)?([^/;]+?)\.(?:svg|png|jpe?g)/i.exec(
      style,
    );
  if (imgMatch) {
    const vendor = slug(imgMatch[1]);
    const middle = imgMatch[2] ? slug(imgMatch[2]) : "";
    const file = slug(imgMatch[3]);
    if (!vendor || !file) return null;
    return middle
      ? `mxgraph.${vendor}.${middle}.${file}`
      : `mxgraph.${vendor}.${file}`;
  }

  return null;
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "default"
  );
}
