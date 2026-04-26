export type Shape = {
  category: string;
  style: string;
  title?: string;
};

const generalShapes: Record<string, Shape> = {
  rectangle: {
    category: "general",
    style: "rounded=0;whiteSpace=wrap;html=1;",
  },
  rounded_rectangle: {
    category: "general",
    style: "rounded=1;whiteSpace=wrap;html=1;",
  },
  text: {
    category: "general",
    style:
      "text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;",
  },
  ellipse: {
    category: "general",
    style: "ellipse;whiteSpace=wrap;html=1;",
  },
  square: {
    category: "general",
    style: "whiteSpace=wrap;html=1;aspect=fixed;",
  },
  circle: {
    category: "general",
    style: "ellipse;whiteSpace=wrap;html=1;aspect=fixed;",
  },
  process: {
    category: "general",
    style: "shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;",
  },
  diamond: {
    category: "general",
    style: "rhombus;whiteSpace=wrap;html=1;",
  },
  parallelogram: {
    category: "general",
    style:
      "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
  },
  hexagon: {
    category: "general",
    style:
      "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;",
  },
  triangle: {
    category: "general",
    style: "triangle;whiteSpace=wrap;html=1;",
  },
  cylinder3: {
    category: "general",
    style:
      "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;",
  },
  cloud: {
    category: "general",
    style: "ellipse;shape=cloud;whiteSpace=wrap;html=1;",
  },
  document: {
    category: "general",
    style: "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;",
  },
  internalStorage: {
    category: "general",
    style: "shape=internalStorage;whiteSpace=wrap;html=1;backgroundOutline=1;",
  },
  cube: {
    category: "general",
    style:
      "shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;",
  },
  step: {
    category: "general",
    style:
      "shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
  },
  trapezoid: {
    category: "general",
    style:
      "shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;fixedSize=1;",
  },
  tape: {
    category: "general",
    style: "shape=tape;whiteSpace=wrap;html=1;",
  },
  note: {
    category: "general",
    style:
      "shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;",
  },
  card: {
    category: "general",
    style: "shape=card;whiteSpace=wrap;html=1;",
  },
  callout: {
    category: "general",
    style: "shape=callout;whiteSpace=wrap;html=1;perimeter=calloutPerimeter;",
  },
  umlActor: {
    category: "general",
    style:
      "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;",
  },
  xor: {
    category: "general",
    style: "shape=xor;whiteSpace=wrap;html=1;",
  },
  or: {
    category: "general",
    style: "shape=or;whiteSpace=wrap;html=1;",
  },
  dataStorage: {
    category: "general",
    style: "shape=dataStorage;whiteSpace=wrap;html=1;fixedSize=1;",
  },
  swimlane: {
    category: "general",
    title: "Container",
    style: "swimlane;startSize=0;",
  },
  verticalContainer: {
    category: "general",
    title: "Vertical Container",
    style: "swimlane;whiteSpace=wrap;html=1;",
  },
  horizontalContainer: {
    category: "general",
    title: "Horizontal Container",
    style: "swimlane;horizontal=0;whiteSpace=wrap;html=1;",
  },
  list: {
    category: "general",
    title: "List",
    style:
      "swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;whiteSpace=wrap;html=1;",
  },
  listItem: {
    category: "general",
    title: "List Item",
    style:
      "text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;spacingRight=4;overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;whiteSpace=wrap;html=1;",
  },
  curve: {
    category: "general",
    style:
      "curved=1;endArrow=classic;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;",
  },
  flexArrow: {
    category: "general",
    title: "Bidirectional Arrow",
    style:
      "shape=flexArrow;endArrow=classic;startArrow=classic;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;curved=1;",
  },
  arrow: {
    category: "general",
    title: "Arrow",
    style:
      "shape=flexArrow;endArrow=classic;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;curved=1;",
  },
  dashedLine: {
    category: "general",
    style:
      "endArrow=none;dashed=1;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;curved=1;",
  },
  dottedLine: {
    category: "general",
    style:
      "endArrow=none;dashed=1;html=1;dashPattern=1 3;strokeWidth=2;rounded=0;fontSize=12;startSize=8;endSize=8;",
  },
  line: {
    category: "general",
    style:
      "endArrow=none;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;curved=1;",
  },
  bidirectionalConnector: {
    category: "general",
    style:
      "endArrow=classic;startArrow=classic;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;curved=1;",
  },
  directionalConnector: {
    category: "general",
    style:
      "endArrow=classic;html=1;rounded=0;fontSize=12;startSize=8;endSize=8;curved=1;",
  },
};

type RuntimeShapeEntry = {
  style: string;
  category: string;
  name: string;
};

let runtimeCatalog: Map<string, RuntimeShapeEntry> = new Map();

export function setRuntimeCatalog(map: Map<string, RuntimeShapeEntry>): void {
  runtimeCatalog = map;
}

export function getRuntimeCatalogSize(): number {
  return runtimeCatalog.size;
}

export function getShape(name: string): Shape | undefined {
  if (Object.prototype.hasOwnProperty.call(generalShapes, name)) {
    return generalShapes[name];
  }
  const r = runtimeCatalog.get(name);
  if (!r) return undefined;
  return { category: r.category, style: r.style, title: r.name || undefined };
}

export function getCategories(): string[] {
  const set = new Set<string>();
  for (const s of Object.values(generalShapes)) set.add(s.category);
  for (const r of runtimeCatalog.values()) set.add(r.category);
  return [...set];
}

export function getShapesByCategory(
  category: string,
): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  for (const [name, s] of Object.entries(generalShapes)) {
    if (s.category === category) {
      out.push({ id: name, title: s.title || name });
    }
  }
  for (const [name, r] of runtimeCatalog) {
    if (r.category === category) {
      out.push({ id: name, title: r.name || name });
    }
  }
  return out;
}

// Backward-compat export. Now contains only the curated `general` shapes;
// vendor shapes live in `runtimeCatalog`. Prefer the helpers above.
export const shapeLibrary: Record<string, Shape> = generalShapes;
