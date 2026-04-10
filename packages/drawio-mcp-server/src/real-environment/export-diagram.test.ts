import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
  selectCell,
} from "./harness.js";
import {
  expectNoBrowserErrors,
  expectNoServerErrors,
  withVerificationScreenshot,
} from "./assertions.js";
import { callToolJson, callToolRaw } from "./tools.js";
import { expectToolSuccess } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

type TextContent = { type: string; text?: string };
type ImageContent = {
  type: string;
  text?: string;
  mimeType?: string;
  data?: string;
};

function findText(content: TextContent[], substring: string) {
  return content.find(
    (item) => item.type === "text" && item.text?.includes(substring),
  );
}

function parseDimensions(metaText: string): { width: number; height: number } {
  const match = metaText.match(/(\d+)x(\d+)/);
  return {
    width: match ? parseInt(match[1], 10) : 0,
    height: match ? parseInt(match[2], 10) : 0,
  };
}

async function saveArtifact(
  artifactRunDir: string,
  name: string,
  data: string | Buffer,
) {
  const filePath = join(artifactRunDir, name);
  await writeFile(filePath, data);
  return filePath;
}

describe("real environment/export-diagram", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("exports as XML with cell content, geometry, and style preserved", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      text: "XML Export Cell",
      style: "fillColor=#dae8fc;strokeColor=#6c8ebf;whiteSpace=wrap;html=1;",
    });
    expectToolSuccess(rectangle);

    const result = await callToolRaw(context, "export-diagram", {
      format: "xml",
    });

    const content = result.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-xml",
      "before-live-state-verification",
      async () => {
        const xmlContent = findText(content, "mxGraphModel");
        expect(xmlContent).toBeDefined();

        const xml = xmlContent!.text!;
        expect(xml).toContain("XML Export Cell");
        expect(xml).toContain(rectangle.result.id);
        expect(xml).toContain("fillColor=#dae8fc");
        expect(xml).toContain("strokeColor=#6c8ebf");
        expect(xml).toContain('width="200"');
        expect(xml).toContain('height="100"');
        expect(xml).toContain('x="100"');
        expect(xml).toContain('y="100"');
        expect(xml).toContain("mxGeometry");
        expect(xml).toContain('vertex="1"');

        const metaContent = findText(content, "Exported xml");
        expect(metaContent).toBeDefined();
        expect(metaContent!.text).toContain("application/xml");

        await saveArtifact(context.artifactRunDir, "export-xml.xml", xml);
      },
    );

    await expectNoBrowserErrors(context, "export-xml");
    await expectNoServerErrors(context, "export-xml", logCountBefore);
  }, 180000);

  it("exports as SVG with renderable structure and positive dimensions", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 50,
      y: 50,
      width: 160,
      height: 80,
      text: "SVG Export Cell",
    });
    expectToolSuccess(rectangle);

    const result = await callToolRaw(context, "export-diagram", {
      format: "svg",
      scale: 1,
      border: 10,
      background: "#f0f0f0",
    });

    const content = result.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-svg",
      "before-live-state-verification",
      async () => {
        const svgContent = findText(content, "<svg");
        expect(svgContent).toBeDefined();

        const svg = svgContent!.text!;
        expect(svg).toContain("SVG Export Cell");
        expect(svg).toContain("xmlns=");
        expect(svg).toMatch(/width="\d+/);
        expect(svg).toMatch(/height="\d+/);
        expect(svg).toContain("</svg>");

        const widthMatch = svg.match(/width="(\d+)/);
        const heightMatch = svg.match(/height="(\d+)/);
        expect(parseInt(widthMatch![1], 10)).toBeGreaterThan(0);
        expect(parseInt(heightMatch![1], 10)).toBeGreaterThan(0);

        const metaContent = findText(content, "Exported svg");
        expect(metaContent).toBeDefined();
        expect(metaContent!.text).toContain("image/svg+xml");

        const dims = parseDimensions(metaContent!.text!);
        expect(dims.width).toBeGreaterThan(0);
        expect(dims.height).toBeGreaterThan(0);

        await saveArtifact(context.artifactRunDir, "export-svg.svg", svg);
      },
    );

    await expectNoBrowserErrors(context, "export-svg");
    await expectNoServerErrors(context, "export-svg", logCountBefore);
  }, 180000);

  it("exports as PNG with non-trivial image data and positive dimensions", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 80,
      y: 80,
      width: 140,
      height: 70,
      text: "PNG Export Cell",
    });
    expectToolSuccess(rectangle);

    const result = await callToolRaw(context, "export-diagram", {
      format: "png",
      scale: 2,
      dpi: 150,
    });

    const content = result.content as ImageContent[];

    await withVerificationScreenshot(
      context,
      "export-png",
      "before-live-state-verification",
      async () => {
        const imageContent = content.find((item) => item.type === "image");
        expect(imageContent).toBeDefined();
        expect(imageContent!.mimeType).toBe("image/png");
        expect(imageContent!.data).toBeTruthy();

        const pngBuffer = Buffer.from(imageContent!.data!, "base64");
        expect(pngBuffer[0]).toBe(0x89);
        expect(pngBuffer[1]).toBe(0x50);
        expect(pngBuffer[2]).toBe(0x4e);
        expect(pngBuffer[3]).toBe(0x47);
        expect(pngBuffer.length).toBeGreaterThan(500);

        const metaContent = content.find(
          (item) =>
            item.type === "text" &&
            (item.text as string | undefined)?.includes("Exported png"),
        ) as TextContent | undefined;
        expect(metaContent).toBeDefined();
        expect(metaContent!.text).toContain("image/png");

        const dims = parseDimensions(metaContent!.text!);
        expect(dims.width).toBeGreaterThan(0);
        expect(dims.height).toBeGreaterThan(0);

        await saveArtifact(context.artifactRunDir, "export-png.png", pngBuffer);
      },
    );

    await expectNoBrowserErrors(context, "export-png");
    await expectNoServerErrors(context, "export-png", logCountBefore);
  }, 180000);

  it("exports XML to a file and file matches returned content", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 100,
      y: 100,
      width: 180,
      height: 90,
      text: "File Export Cell",
      style: "fillColor=#ffe6cc;strokeColor=#d79b00;whiteSpace=wrap;html=1;",
    });
    expectToolSuccess(rectangle);

    const exportPath = join(context.artifactRunDir, "export-xml-file.xml");

    const result = await callToolRaw(context, "export-diagram", {
      format: "xml",
      output_path: exportPath,
    });

    const content = result.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-xml-file",
      "before-live-state-verification",
      async () => {
        expect(existsSync(exportPath)).toBe(true);

        const fileContent = readFileSync(exportPath, "utf-8");
        expect(fileContent).toContain("mxGraphModel");
        expect(fileContent).toContain("File Export Cell");
        expect(fileContent).toContain(rectangle.result.id);
        expect(fileContent).toContain("fillColor=#ffe6cc");
        expect(fileContent).toContain('width="180"');
        expect(fileContent).toContain('height="90"');

        const returnedXml = findText(content, "mxGraphModel");
        expect(returnedXml).toBeDefined();
        expect(fileContent).toBe(returnedXml!.text);

        const savedContent = findText(content, "Saved to:");
        expect(savedContent).toBeDefined();
        expect(savedContent!.text).toContain(exportPath);
      },
    );

    await expectNoBrowserErrors(context, "export-xml-file");
    await expectNoServerErrors(context, "export-xml-file", logCountBefore);
  }, 180000);

  it("exports SVG to a file with valid SVG structure", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 60,
      y: 60,
      width: 150,
      height: 80,
      text: "SVG File Cell",
    });
    expectToolSuccess(rectangle);

    const exportPath = join(context.artifactRunDir, "export-svg-file.svg");

    const result = await callToolRaw(context, "export-diagram", {
      format: "svg",
      output_path: exportPath,
    });

    const content = result.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-svg-file",
      "before-live-state-verification",
      async () => {
        expect(existsSync(exportPath)).toBe(true);

        const fileContent = readFileSync(exportPath, "utf-8");
        expect(fileContent).toContain("<svg");
        expect(fileContent).toContain("</svg>");
        expect(fileContent).toContain("SVG File Cell");
        expect(fileContent).toContain("xmlns=");
        expect(fileContent).toMatch(/width="\d+/);
        expect(fileContent).toMatch(/height="\d+/);

        const returnedSvg = findText(content, "<svg");
        expect(returnedSvg).toBeDefined();
        expect(fileContent).toBe(returnedSvg!.text);

        const savedContent = findText(content, "Saved to:");
        expect(savedContent).toBeDefined();
      },
    );

    await expectNoBrowserErrors(context, "export-svg-file");
    await expectNoServerErrors(context, "export-svg-file", logCountBefore);
  }, 180000);

  it("exports PNG to a file with valid PNG binary data", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 70,
      y: 70,
      width: 130,
      height: 65,
      text: "PNG File Cell",
    });
    expectToolSuccess(rectangle);

    const exportPath = join(context.artifactRunDir, "export-png-file.png");

    const result = await callToolRaw(context, "export-diagram", {
      format: "png",
      output_path: exportPath,
    });

    const content = result.content as ImageContent[];

    await withVerificationScreenshot(
      context,
      "export-png-file",
      "before-live-state-verification",
      async () => {
        expect(existsSync(exportPath)).toBe(true);

        const fileBuffer = readFileSync(exportPath);
        expect(fileBuffer[0]).toBe(0x89);
        expect(fileBuffer[1]).toBe(0x50);
        expect(fileBuffer[2]).toBe(0x4e);
        expect(fileBuffer[3]).toBe(0x47);
        expect(fileBuffer.length).toBeGreaterThan(500);

        const imageContent = content.find((item) => item.type === "image");
        expect(imageContent).toBeDefined();
        const returnedBuffer = Buffer.from(imageContent!.data!, "base64");
        expect(fileBuffer.equals(returnedBuffer)).toBe(true);

        const savedContent = content.find(
          (item) =>
            item.type === "text" &&
            (item.text as string | undefined)?.includes("Saved to:"),
        );
        expect(savedContent).toBeDefined();
      },
    );

    await expectNoBrowserErrors(context, "export-png-file");
    await expectNoServerErrors(context, "export-png-file", logCountBefore);
  }, 180000);

  it("exports with transparent background and SVG has no background rect", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      text: "Transparent BG",
    });
    expectToolSuccess(rectangle);

    const opaqueResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
      transparent: false,
      background: "#ff0000",
    });
    const opaqueContent = opaqueResult.content as TextContent[];
    const opaqueSvg = findText(opaqueContent, "<svg");

    const transparentResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
      transparent: true,
    });
    const transparentContent = transparentResult.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-transparent",
      "before-live-state-verification",
      async () => {
        const svgContent = findText(transparentContent, "<svg");
        expect(svgContent).toBeDefined();
        expect(svgContent!.text).toContain("Transparent BG");
        expect(svgContent!.text).toContain("</svg>");

        expect(svgContent!.text).not.toContain("#ff0000");

        expect(opaqueSvg).toBeDefined();
        expect(opaqueSvg!.text).toContain("#ff0000");

        const metaContent = findText(transparentContent, "Exported svg");
        expect(metaContent).toBeDefined();

        await saveArtifact(
          context.artifactRunDir,
          "export-transparent-opaque.svg",
          opaqueSvg!.text!,
        );
        await saveArtifact(
          context.artifactRunDir,
          "export-transparent-transparent.svg",
          svgContent!.text!,
        );
      },
    );

    await expectNoBrowserErrors(context, "export-transparent");
    await expectNoServerErrors(context, "export-transparent", logCountBefore);
  }, 180000);

  it("exports SVG with embedded XML containing diagram data", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 90,
      y: 90,
      width: 150,
      height: 75,
      text: "Embed XML Cell",
    });
    expectToolSuccess(rectangle);

    const plainResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
      embed_xml: false,
    });
    const plainContent = plainResult.content as TextContent[];

    const embeddedResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
      embed_xml: true,
    });
    const embeddedContent = embeddedResult.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-svg-embed-xml",
      "before-live-state-verification",
      async () => {
        const embeddedSvg = findText(embeddedContent, "Embed XML Cell");
        expect(embeddedSvg).toBeDefined();

        const embeddedData = embeddedSvg!.text!;
        expect(embeddedData).toContain("mxGraphModel");
        expect(embeddedData).toContain("mxfile");

        const plainSvg = findText(plainContent, "<svg");
        expect(plainSvg).toBeDefined();
        expect(plainSvg!.text).not.toContain("mxfile");

        expect(embeddedData.length).toBeGreaterThan(plainSvg!.text!.length);

        const metaContent = findText(embeddedContent, "Exported svg");
        expect(metaContent).toBeDefined();
        expect(metaContent!.text).toContain("image/svg+xml");

        await saveArtifact(
          context.artifactRunDir,
          "export-svg-plain.svg",
          plainSvg!.text!,
        );
        await saveArtifact(
          context.artifactRunDir,
          "export-svg-embedded.svg",
          embeddedData,
        );
      },
    );

    await expectNoBrowserErrors(context, "export-svg-embed-xml");
    await expectNoServerErrors(context, "export-svg-embed-xml", logCountBefore);
  }, 180000);

  it("exports only the selected cell in SVG and excludes unselected cells", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: selectedRect } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 100,
      y: 100,
      width: 140,
      height: 70,
      text: "Selected Cell",
    });
    expectToolSuccess(selectedRect);

    const { payload: otherRect } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 350,
      y: 100,
      width: 140,
      height: 70,
      text: "Unselected Cell",
    });
    expectToolSuccess(otherRect);

    await selectCell(context.page, selectedRect.result.id);

    // SVG export respects selection_only by rendering only the selected cells
    const selectionResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
      selection_only: true,
      size: "selection",
    });
    const selectionContent = selectionResult.content as TextContent[];

    const fullResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
    });
    const fullContent = fullResult.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-selection-only",
      "before-live-state-verification",
      async () => {
        const selectionSvg = findText(selectionContent, "<svg");
        expect(selectionSvg).toBeDefined();
        expect(selectionSvg!.text).toContain("Selected Cell");
        expect(selectionSvg!.text).not.toContain("Unselected Cell");

        const fullSvg = findText(fullContent, "<svg");
        expect(fullSvg).toBeDefined();
        expect(fullSvg!.text).toContain("Selected Cell");
        expect(fullSvg!.text).toContain("Unselected Cell");

        await saveArtifact(
          context.artifactRunDir,
          "export-selection-only.svg",
          selectionSvg!.text!,
        );
        await saveArtifact(
          context.artifactRunDir,
          "export-selection-full.svg",
          fullSvg!.text!,
        );
      },
    );

    await expectNoBrowserErrors(context, "export-selection-only");
    await expectNoServerErrors(
      context,
      "export-selection-only",
      logCountBefore,
    );
  }, 180000);

  it("exports multiple cells and all appear in the output", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const cellNames = ["Alpha", "Beta", "Gamma"];
    const cellIds: string[] = [];

    for (let i = 0; i < cellNames.length; i++) {
      const { payload } = await callToolJson<{
        success: boolean;
        result: { id: string };
      }>(context, "add-rectangle", {
        x: 50 + i * 200,
        y: 100,
        width: 140,
        height: 70,
        text: cellNames[i],
      });
      expectToolSuccess(payload);
      cellIds.push(payload.result.id);
    }

    const xmlResult = await callToolRaw(context, "export-diagram", {
      format: "xml",
    });
    const xmlContent = xmlResult.content as TextContent[];

    const svgResult = await callToolRaw(context, "export-diagram", {
      format: "svg",
    });
    const svgContent = svgResult.content as TextContent[];

    const pngResult = await callToolRaw(context, "export-diagram", {
      format: "png",
    });
    const pngContent = pngResult.content as ImageContent[];

    await withVerificationScreenshot(
      context,
      "export-multi-cell",
      "before-live-state-verification",
      async () => {
        const xml = findText(xmlContent, "mxGraphModel");
        expect(xml).toBeDefined();
        for (const name of cellNames) {
          expect(xml!.text).toContain(name);
        }
        for (const id of cellIds) {
          expect(xml!.text).toContain(id);
        }

        const vertexMatches = xml!.text!.match(/vertex="1"/g);
        expect(vertexMatches).not.toBeNull();
        expect(vertexMatches!.length).toBeGreaterThanOrEqual(cellNames.length);

        const svg = findText(svgContent, "<svg");
        expect(svg).toBeDefined();
        for (const name of cellNames) {
          expect(svg!.text).toContain(name);
        }

        await saveArtifact(
          context.artifactRunDir,
          "export-multi-cell.xml",
          xml!.text!,
        );
        await saveArtifact(
          context.artifactRunDir,
          "export-multi-cell.svg",
          svg!.text!,
        );

        const pngImage = pngContent.find((item) => item.type === "image");
        expect(pngImage).toBeDefined();
        await saveArtifact(
          context.artifactRunDir,
          "export-multi-cell.png",
          Buffer.from(pngImage!.data!, "base64"),
        );
      },
    );

    await expectNoBrowserErrors(context, "export-multi-cell");
    await expectNoServerErrors(context, "export-multi-cell", logCountBefore);
  }, 180000);

  it("exports an empty diagram with only root cells", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const result = await callToolRaw(context, "export-diagram", {
      format: "xml",
    });

    const content = result.content as TextContent[];

    await withVerificationScreenshot(
      context,
      "export-empty",
      "before-live-state-verification",
      async () => {
        const xmlContent = findText(content, "mxGraphModel");
        expect(xmlContent).toBeDefined();

        const xml = xmlContent!.text!;
        expect(xml).toContain("mxGraphModel");
        expect(xml).toContain('<mxCell id="0"');
        expect(xml).toContain('<mxCell id="1"');
        expect(xml).not.toMatch(/vertex="1"/);

        const metaContent = findText(content, "Exported xml");
        expect(metaContent).toBeDefined();
        expect(metaContent!.text).toContain("application/xml");

        await saveArtifact(context.artifactRunDir, "export-empty.xml", xml);
      },
    );

    await expectNoBrowserErrors(context, "export-empty");
    await expectNoServerErrors(context, "export-empty", logCountBefore);
  }, 180000);
});
