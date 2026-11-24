import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { getLatestWarUrl } from "./downloader.js";

const FALLBACK_URL =
  "https://github.com/jgraph/drawio/releases/latest/download/draw.war";

const releasePayload = {
  assets: [
    {
      name: "draw.war",
      browser_download_url: "https://example.test/draw.war",
    },
  ],
};

describe("getLatestWarUrl", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalToken;
    }
    jest.restoreAllMocks();
  });

  function mockFetch(status = 200) {
    const fetchMock = jest.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify(status === 200 ? releasePayload : {}), {
          status,
          headers: { "content-type": "application/json" },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("sends a bearer token when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    const fetchMock = mockFetch();

    await getLatestWarUrl();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
  });

  it("omits authorization when GITHUB_TOKEN is unset", async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = mockFetch();

    await getLatestWarUrl();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("returns the asset URL advertised by the API", async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch();

    await expect(getLatestWarUrl()).resolves.toBe(
      "https://example.test/draw.war",
    );
  });

  it("falls back to the latest asset URL when the API is rate limited", async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch(403);

    await expect(getLatestWarUrl()).resolves.toBe(FALLBACK_URL);
  });

  it("falls back to the latest asset URL when the API is unreachable", async () => {
    delete process.env.GITHUB_TOKEN;
    globalThis.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(getLatestWarUrl()).resolves.toBe(FALLBACK_URL);
  });
});
