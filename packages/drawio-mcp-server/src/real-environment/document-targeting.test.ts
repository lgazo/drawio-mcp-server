import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  openConnectedDrawioPage,
  resetDiagram,
} from "./harness.js";
import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import { callToolJson } from "./tools.js";
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

type PageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: boolean;
};

type DocumentInfo = {
  id: string;
  title: string | null;
  mode: string | null;
  hash: string | null;
  file_url: string | null;
  page_count: number;
  current_page: {
    index: number;
    id: string;
    name: string;
    is_current: true;
  } | null;
};

function firstText(result: CallToolResult) {
  return (result.content as Array<{ type: string; text?: string }>).find(
    (item) => item.type === "text",
  )?.text;
}

describe("real environment/document targeting", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("lists connected documents and requires target_document when multiple tabs are connected", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: renamedDocOnePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "rename-page", {
      page: { index: 0 },
      name: "Doc One Page A",
    });
    expectToolSuccess(renamedDocOnePayload);
    const docOneCurrentPage = unwrapToolPayload<PageInfo>(renamedDocOnePayload);
    expect(docOneCurrentPage.name).toBe("Doc One Page A");

    const { payload: createdDocOnePagePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "create-page", {
      name: "Doc One Page B",
    });
    expectToolSuccess(createdDocOnePagePayload);
    const docOneSecondPage = unwrapToolPayload<PageInfo>(
      createdDocOnePagePayload,
    );
    expect(docOneSecondPage.name).toBe("Doc One Page B");

    const { payload: singleDocumentPayload } = await callToolJson<{
      success: boolean;
      result: DocumentInfo[];
    }>(context, "list-documents", {});
    expectToolSuccess(singleDocumentPayload);
    const [docOne] = unwrapToolPayload<DocumentInfo[]>(singleDocumentPayload);
    expect(docOne).toMatchObject({
      page_count: 2,
      current_page: {
        id: docOneCurrentPage.id,
        name: "Doc One Page A",
        is_current: true,
      },
    });

    const secondPage = await openConnectedDrawioPage({
      browser: context.browser,
      httpPort: context.httpPort,
      wsPort: context.wsPort,
      browserMessages: context.browserMessages,
    });

    try {
      const { payload: twoDocumentsPayload } = await callToolJson<{
        success: boolean;
        result: DocumentInfo[];
      }>(context, "list-documents", {});
      expectToolSuccess(twoDocumentsPayload);
      const documents = unwrapToolPayload<DocumentInfo[]>(twoDocumentsPayload);
      expect(documents).toHaveLength(2);

      const refreshedDocOne = documents.find(
        (document) => document.id === docOne.id,
      );
      const docTwo = documents.find((document) => document.id !== docOne.id);
      expect(refreshedDocOne?.page_count).toBe(2);
      expect(docTwo).toBeDefined();

      const { payload: renamedDocTwoPayload } = await callToolJson<{
        success: boolean;
        result: PageInfo;
      }>(context, "rename-page", {
        target_document: { id: docTwo!.id },
        page: { index: 0 },
        name: "Doc Two Page Only",
      });
      expectToolSuccess(renamedDocTwoPayload);
      const docTwoCurrentPage =
        unwrapToolPayload<PageInfo>(renamedDocTwoPayload);
      expect(docTwoCurrentPage.name).toBe("Doc Two Page Only");

      const ambiguousListPages = (await context.client.callTool({
        name: "list-pages",
        arguments: {},
      })) as CallToolResult;
      expect(ambiguousListPages.isError).toBe(true);
      expect(firstText(ambiguousListPages)).toContain(
        "Multiple Draw.io documents are connected",
      );

      const { payload: docOnePagesPayload } = await callToolJson<{
        success: boolean;
        result: PageInfo[];
      }>(context, "list-pages", {
        target_document: { id: docOne.id },
      });
      expectToolSuccess(docOnePagesPayload);
      const docOnePages = unwrapToolPayload<PageInfo[]>(docOnePagesPayload);
      expect(docOnePages.map((page) => page.name)).toEqual([
        "Doc One Page A",
        "Doc One Page B",
      ]);

      const { payload: docTwoPagesPayload } = await callToolJson<{
        success: boolean;
        result: PageInfo[];
      }>(context, "list-pages", {
        target_document: { id: docTwo!.id },
      });
      expectToolSuccess(docTwoPagesPayload);
      const docTwoPages = unwrapToolPayload<PageInfo[]>(docTwoPagesPayload);
      expect(docTwoPages).toEqual([
        {
          index: 0,
          id: docTwoCurrentPage.id,
          name: "Doc Two Page Only",
          is_current: true,
        },
      ]);

      const { payload: finalDocumentsPayload } = await callToolJson<{
        success: boolean;
        result: DocumentInfo[];
      }>(context, "list-documents", {});
      expectToolSuccess(finalDocumentsPayload);
      const finalDocuments = unwrapToolPayload<DocumentInfo[]>(
        finalDocumentsPayload,
      );
      const finalDocOne = finalDocuments.find(
        (document) => document.id === docOne.id,
      );
      const finalDocTwo = finalDocuments.find(
        (document) => document.id === docTwo!.id,
      );
      expect(finalDocOne).toMatchObject({
        page_count: 2,
        current_page: {
          id: docOneCurrentPage.id,
          name: "Doc One Page A",
          is_current: true,
        },
      });
      expect(finalDocTwo).toMatchObject({
        page_count: 1,
        current_page: {
          id: docTwoCurrentPage.id,
          name: "Doc Two Page Only",
          is_current: true,
        },
      });
    } finally {
      await secondPage.close();
    }

    await expectNoBrowserErrors(context, "document-targeting");
    await expectNoServerErrors(context, "document-targeting", logCountBefore);
  }, 180000);
});
