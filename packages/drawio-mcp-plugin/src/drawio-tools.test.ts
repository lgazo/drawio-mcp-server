import { describe, expect, it } from "@jest/globals";
import { import_diagram } from "./drawio-tools.js";

// import_diagram reads mxUtils/mxCell/mxGeometry off `window` at call time,
// and walks the parsed XML DOM. The plugin test env is node (no DOMParser,
// no jsdom), so provide a minimal fake DOM plus mx* stubs that cover the
// add-mode import path.

class FakeElement {
  nodeName: string;
  nodeType = 1;
  parentNode: FakeElement | null = null;
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];

  constructor(nodeName: string, attrs: Record<string, string> = {}) {
    this.nodeName = nodeName;
    this.attrs = attrs;
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }

  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }

  append(child: FakeElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (node: FakeElement) => {
      for (const child of node.children) {
        if (child.nodeName === selector) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  getElementsByTagName(selector: string): FakeElement[] {
    return this.querySelectorAll(selector);
  }
}

class FakeCell {
  id: string | null = null;
  value: string | null = null;
  style: string | null = null;
  vertex = false;
  edge = false;
  geometry: any = null;
  source: FakeCell | null = null;
  target: FakeCell | null = null;
  parent: FakeCell | null = null;

  setId(id: string | null): void {
    this.id = id;
  }
  getId(): string | null {
    return this.id;
  }
  setValue(value: string): void {
    this.value = value;
  }
  setStyle(style: string): void {
    this.style = style;
  }
  setGeometry(geometry: any): void {
    this.geometry = geometry;
  }
}

class FakeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  relative = false;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

type FakeModel = {
  added: FakeCell[];
  beginUpdate: () => void;
  endUpdate: () => void;
  add: (parent: any, cell: FakeCell) => void;
  getCell: (id: string) => FakeCell | null;
  setTerminal: (edge: FakeCell, terminal: FakeCell, isSource: boolean) => void;
};

function makeModel(): FakeModel {
  const added: FakeCell[] = [];
  let nextId = 2;
  return {
    added,
    beginUpdate() {},
    endUpdate() {},
    add(_parent: any, cell: FakeCell) {
      if (cell.getId() == null) cell.setId(String(nextId++));
      added.push(cell);
    },
    getCell(id: string) {
      return added.find((cell) => cell.getId() === id) ?? null;
    },
    setTerminal(edge: FakeCell, terminal: FakeCell, isSource: boolean) {
      if (isSource) edge.source = terminal;
      else edge.target = terminal;
    },
  };
}

function installWindow(doc: FakeElement, model: FakeModel): void {
  const globalAny = globalThis as any;
  globalAny.window = {
    mxUtils: {
      parseXml: () => ({
        documentElement: doc,
        getElementsByTagName: (sel: string) => doc.getElementsByTagName(sel),
      }),
    },
    mxCell: FakeCell,
    mxGeometry: FakeGeometry,
    mxCellStub: undefined,
  };
  globalAny.__testModel = model;
}

function makeUi(model: FakeModel) {
  return {
    editor: {
      graph: {
        getDefaultParent: () => ({}),
        getModel: () => model,
      },
    },
  };
}

// Builds the wrapper-shaped XML that draw.io's Mermaid pipeline emits:
// vertices wrapped in <object label="..." id="..."> with style/vertex and
// geometry on the inner <mxCell>, edges as bare <mxCell> referencing the
// wrapper ids.
function makeWrapperDoc(wrapperName: string): FakeElement {
  const modelEl = new FakeElement("mxGraphModel");
  const root = new FakeElement("root");
  modelEl.append(root);

  root.append(new FakeElement("mxCell", { id: "0" }));
  root.append(new FakeElement("mxCell", { id: "1", parent: "0" }));

  const wrapA = new FakeElement(wrapperName, { label: "Alpha", id: "A" });
  const cellA = new FakeElement("mxCell", {
    style: "rounded=1;",
    vertex: "1",
    parent: "1",
  });
  cellA.append(
    new FakeElement("mxGeometry", {
      x: "10",
      y: "10",
      width: "80",
      height: "40",
      as: "geometry",
    }),
  );
  wrapA.append(cellA);
  root.append(wrapA);

  const wrapB = new FakeElement(wrapperName, { label: "Beta", id: "B" });
  const cellB = new FakeElement("mxCell", {
    style: "rounded=1;",
    vertex: "1",
    parent: "1",
  });
  cellB.append(
    new FakeElement("mxGeometry", {
      x: "200",
      y: "10",
      width: "80",
      height: "40",
      as: "geometry",
    }),
  );
  wrapB.append(cellB);
  root.append(wrapB);

  const edge = new FakeElement("mxCell", {
    id: "E",
    style: "edgeStyle=orthogonalEdgeStyle;",
    edge: "1",
    parent: "1",
    source: "A",
    target: "B",
  });
  edge.append(
    new FakeElement("mxGeometry", { relative: "1", as: "geometry" }),
  );
  root.append(edge);

  return modelEl;
}

// Plain draw.io XML with bare mxCells carrying value/id directly.
function makeBareDoc(): FakeElement {
  const modelEl = new FakeElement("mxGraphModel");
  const root = new FakeElement("root");
  modelEl.append(root);

  root.append(new FakeElement("mxCell", { id: "0" }));
  root.append(new FakeElement("mxCell", { id: "1", parent: "0" }));

  root.append(
    new FakeElement("mxCell", {
      id: "V1",
      value: "Alpha",
      style: "rounded=1;",
      vertex: "1",
      parent: "1",
    }),
  );
  root.append(
    new FakeElement("mxCell", {
      id: "V2",
      value: "Beta",
      style: "rounded=1;",
      vertex: "1",
      parent: "1",
    }),
  );
  root.append(
    new FakeElement("mxCell", {
      id: "E",
      style: "edgeStyle=orthogonalEdgeStyle;",
      edge: "1",
      parent: "1",
      source: "V1",
      target: "V2",
    }),
  );

  return modelEl;
}

describe("import_diagram add mode", () => {
  it("keeps labels and edge terminals for object-wrapped Mermaid cells", () => {
    const doc = makeWrapperDoc("object");
    const model = makeModel();
    installWindow(doc, model);
    const ui = makeUi(model);

    const result = import_diagram(ui, {
      data: "<mxGraphModel/>",
      format: "xml",
      mode: "add",
    });

    expect(result.success).toBe(true);
    expect(model.added).toHaveLength(3);

    const vertices = model.added.filter((cell) => cell.vertex);
    expect(vertices).toHaveLength(2);
    expect(vertices.map((cell) => cell.value)).toEqual(["Alpha", "Beta"]);

    const edge = model.added.find((cell) => cell.edge)!;
    expect(edge.source).not.toBeNull();
    expect(edge.target).not.toBeNull();
    expect(edge.source?.value).toBe("Alpha");
    expect(edge.target?.value).toBe("Beta");
    expect(edge.geometry.relative).toBe(true);
  });

  it("treats UserObject wrappers the same as object wrappers", () => {
    const doc = makeWrapperDoc("UserObject");
    const model = makeModel();
    installWindow(doc, model);

    const result = import_diagram(makeUi(model), {
      data: "<mxGraphModel/>",
      format: "xml",
      mode: "add",
    });

    expect(result.success).toBe(true);
    const vertices = model.added.filter((cell) => cell.vertex);
    expect(vertices.map((cell) => cell.value)).toEqual(["Alpha", "Beta"]);
    const edge = model.added.find((cell) => cell.edge)!;
    expect(edge.source?.value).toBe("Alpha");
    expect(edge.target?.value).toBe("Beta");
  });

  it("still imports bare mxCells with labels and terminals unchanged", () => {
    const doc = makeBareDoc();
    const model = makeModel();
    installWindow(doc, model);

    const result = import_diagram(makeUi(model), {
      data: "<mxGraphModel/>",
      format: "xml",
      mode: "add",
    });

    expect(result.success).toBe(true);
    const vertices = model.added.filter((cell) => cell.vertex);
    expect(vertices.map((cell) => cell.value)).toEqual(["Alpha", "Beta"]);
    const edge = model.added.find((cell) => cell.edge)!;
    expect(edge.source?.value).toBe("Alpha");
    expect(edge.target?.value).toBe("Beta");
  });
});