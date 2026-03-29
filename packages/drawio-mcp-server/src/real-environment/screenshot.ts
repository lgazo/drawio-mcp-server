import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Page } from "@playwright/test";

const ARTIFACTS_ROOT = join(process.cwd(), ".artifacts", "real-environment");

function normalizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-");
}

async function captureDiagramXml(page: Page, xmlPath: string) {
  const xml = await page.evaluate(() => {
    const maybeWindow = window as any;
    const editor = maybeWindow.ui?.editor;

    if (!editor) {
      return "";
    }

    if (typeof editor.getGraphXml === "function") {
      const xmlNode = editor.getGraphXml();
      const xmlText = (window as any).mxUtils?.getXml?.(xmlNode);
      return typeof xmlText === "string" ? xmlText : "";
    }

    const graph = editor.graph;
    const encoder = new (window as any).mxCodec();
    const node = encoder.encode(graph.getModel());
    return (window as any).mxUtils?.getXml?.(node) ?? "";
  });

  await writeFile(xmlPath, xml, "utf-8");
}

export async function captureVerificationArtifact(
  artifactRunDir: string,
  page: Page,
  testName: string,
  stepName: string,
) {
  await mkdir(artifactRunDir, { recursive: true });

  const fileName = `${normalizeSegment(testName)}-${normalizeSegment(stepName)}-${Date.now()}.png`;
  const filePath = join(artifactRunDir, fileName);
  const xmlPath = filePath.replace(/\.png$/, ".xml");

  await page.screenshot({
    path: filePath,
    fullPage: true,
  });
  await captureDiagramXml(page, xmlPath);

  return {
    screenshotPath: filePath,
    xmlPath,
  };
}

export async function createArtifactRunDir() {
  await mkdir(ARTIFACTS_ROOT, { recursive: true });

  const runDir = join(ARTIFACTS_ROOT, `run-${Date.now()}`);
  await mkdir(runDir, { recursive: true });
  return runDir;
}
