import { jest } from "@jest/globals";
import { build_channel, default_tool, Handler } from "./tool.js";
import { Bus, BusListener, Context, IdGenerator, Logger } from "./types.js";
import {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { create_logger } from "./standard_console_logger.js";
import { create_request_queue } from "./request_queue.js";
import { ConnectedDocumentInfo, DocumentRouting } from "./types.js";

describe("build_channel", () => {
  let mockBus: jest.Mocked<Bus>;
  let mockIdGenerator: { generate: jest.Mock<() => string> };
  let mockRequestQueue: { enqueue: jest.Mock<any> };
  let mockDocumentRouting: jest.Mocked<DocumentRouting>;
  let context: Context;
  const mockHandler = jest.fn<Handler>();
  const log = create_logger();
  const resolvedDocument: ConnectedDocumentInfo = {
    id: "doc-1",
    title: "Document One",
    mode: "local",
    hash: null,
    file_url: null,
    page_count: 1,
    current_page: {
      index: 0,
      id: "page-1",
      name: "Page 1",
      is_current: true,
    },
  };

  beforeEach(() => {
    mockBus = {
      send_to_extension: jest.fn(),
      on_reply_from_extension: jest.fn(() => jest.fn()),
    } as unknown as jest.Mocked<Bus>;

    mockIdGenerator = {
      generate: jest.fn<() => string>().mockReturnValue("123"),
    };

    mockRequestQueue = {
      enqueue: jest.fn((_: string, task: () => Promise<CallToolResult>) =>
        task(),
      ),
    };

    mockDocumentRouting = {
      list_documents: jest.fn(async () => [resolvedDocument]),
      resolve_target_document: jest.fn(async () => ({
        connection_id: "conn-1",
        target_document: { id: resolvedDocument.id },
        document: resolvedDocument,
      })),
    };

    context = {
      bus: mockBus,
      id_generator: mockIdGenerator,
      request_queue: mockRequestQueue,
      document_routing: mockDocumentRouting,
      log,
    };

    mockHandler.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("should create a function that sends a message via bus", async () => {
    const eventName = "test-event";
    const toolFn = build_channel(context, eventName, mockHandler, {
      routing: "none",
    });
    mockHandler.mockReturnValue({
      content: [{ type: "text", text: "ok" }],
    });

    const args = { key: "value" };
    const extra = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const promise = toolFn(args, extra);

    expect(mockBus.send_to_extension).toHaveBeenCalledWith({
      __event: eventName,
      __request_id: "123",
      key: "value",
    });

    const replyCallback = mockBus.on_reply_from_extension.mock.calls[0][1];
    replyCallback({ ok: true });
    await expect(promise).resolves.toEqual({
      content: [{ type: "text", text: "ok" }],
    });
  });

  it("should wait for reply and call handler with response", async () => {
    const eventName = "test-event";
    const toolFn = build_channel(context, eventName, mockHandler, {
      routing: "none",
    });

    const mockResponse: CallToolResult = {
      content: [{ type: "text", text: "response" }],
    };
    mockHandler.mockReturnValue(mockResponse);

    const promise = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    // Simulate reply callback
    const replyCallback = mockBus.on_reply_from_extension.mock.calls[0][1];
    replyCallback({ data: "test" });

    const result = await promise;

    expect(mockBus.on_reply_from_extension).toHaveBeenCalledWith(
      "test-event.123",
      expect.any(Function),
    );
    expect(mockHandler).toHaveBeenCalledWith({ data: "test" });
    expect(result).toEqual(mockResponse);
  });

  it("should use correct reply channel name format", async () => {
    mockIdGenerator.generate.mockReturnValue("456");
    const eventName = "another-event";
    const toolFn = build_channel(context, eventName, mockHandler, {
      routing: "none",
    });
    mockHandler.mockReturnValue({
      content: [{ type: "text", text: "ok" }],
    });

    const promise = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    expect(mockBus.on_reply_from_extension).toHaveBeenCalledWith(
      "another-event.456",
      expect.any(Function),
    );

    const replyCallback = mockBus.on_reply_from_extension.mock.calls[0][1];
    replyCallback({ ok: true });
    await expect(promise).resolves.toEqual({
      content: [{ type: "text", text: "ok" }],
    });
  });

  it("should enqueue queued tools through the shared request queue", async () => {
    const eventName = "queued-event";
    const toolFn = build_channel(context, eventName, mockHandler, {
      queue: true,
      routing: "none",
    });

    mockHandler.mockReturnValue({
      content: [{ type: "text", text: "queued" }],
    });

    const promise = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );
    const replyCallback = mockBus.on_reply_from_extension.mock.calls[0][1];
    replyCallback({ data: "queued" });

    await promise;

    expect(mockRequestQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
      "global",
      expect.any(Function),
    );
  });

  it("should time out pending requests and unsubscribe the reply listener", async () => {
    jest.useFakeTimers();
    const eventName = "timeout-event";
    const unsubscribe = jest.fn();
    mockBus.on_reply_from_extension.mockReturnValue(unsubscribe);
    const toolFn = build_channel(context, eventName, mockHandler, {
      reply_timeout_ms: 25,
      routing: "none",
    });

    const promise = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );
    const failure = expect(promise).rejects.toThrow(
      "Timed out waiting for reply to `timeout-event` after 25ms",
    );

    await jest.advanceTimersByTimeAsync(25);

    await failure;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("should continue queued processing after a timed out request", async () => {
    jest.useFakeTimers();
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    const toolFn = build_channel(
      {
        ...context,
        request_queue: create_request_queue(log),
      },
      "queued-timeout-event",
      (reply) => ({
        content: [{ type: "text", text: JSON.stringify(reply) }],
      }),
      {
        queue: true,
        reply_timeout_ms: 25,
        routing: "none",
      },
    );

    mockIdGenerator.generate
      .mockReturnValueOnce("first")
      .mockReturnValueOnce("second");
    mockBus.on_reply_from_extension.mockImplementation(
      (event_name, listener) => {
        listeners.set(
          event_name,
          listener as BusListener<Record<string, unknown>>,
        );
        return () => {
          listeners.delete(event_name);
        };
      },
    );

    const first = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );
    const second = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    await Promise.resolve();
    expect(listeners.has("queued-timeout-event.first")).toBe(true);
    expect(listeners.has("queued-timeout-event.second")).toBe(false);

    const firstFailure = expect(first).rejects.toThrow(
      "Timed out waiting for reply to `queued-timeout-event` after 25ms",
    );
    await jest.advanceTimersByTimeAsync(25);
    await firstFailure;

    await Promise.resolve();
    expect(listeners.has("queued-timeout-event.second")).toBe(true);

    listeners.get("queued-timeout-event.second")?.({
      __event: "queued-timeout-event.second",
      data: "ok",
    });

    await expect(second).resolves.toEqual({
      content: [{ type: "text", text: JSON.stringify({ data: "ok" }) }],
    });
  });

  it("resolves the target document by default and injects it into the request", async () => {
    const toolFn = build_channel(context, "document-event", mockHandler, {
      queue: true,
    });
    mockHandler.mockReturnValue({
      content: [{ type: "text", text: "ok" }],
    });

    const promise = toolFn(
      { key: "value" },
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    await Promise.resolve();
    const replyCallback = mockBus.on_reply_from_extension.mock.calls[0][1];
    replyCallback({ ok: true });
    await promise;

    expect(mockDocumentRouting.resolve_target_document).toHaveBeenCalledWith({
      key: "value",
    });
    expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
      "conn-1",
      expect.any(Function),
    );
    expect(mockBus.send_to_extension).toHaveBeenCalledWith({
      __event: "document-event",
      __request_id: "123",
      key: "value",
      target_document: { id: "doc-1" },
      __target_connection_id: "conn-1",
    });
  });

  it("propagates document routing errors before sending any request", async () => {
    mockDocumentRouting.resolve_target_document.mockRejectedValueOnce(
      new Error("No connected Draw.io documents"),
    );
    const toolFn = build_channel(context, "document-event", mockHandler);

    await expect(
      toolFn({}, {} as RequestHandlerExtra<ServerRequest, ServerNotification>),
    ).rejects.toThrow("No connected Draw.io documents");

    expect(mockBus.send_to_extension).not.toHaveBeenCalled();
  });

  it("fails queued document requests immediately when delivery breaks after waiting in queue", async () => {
    const listeners = new Map<string, BusListener<Record<string, unknown>>>();
    let sendCount = 0;

    mockIdGenerator.generate
      .mockReturnValueOnce("first")
      .mockReturnValueOnce("second");
    mockBus.send_to_extension.mockImplementation(() => {
      sendCount += 1;

      if (sendCount === 2) {
        throw new Error(
          "Target document doc-1 is no longer connected; call list-documents and retry",
        );
      }
    });
    mockBus.on_reply_from_extension.mockImplementation(
      (event_name, listener) => {
        listeners.set(
          event_name,
          listener as BusListener<Record<string, unknown>>,
        );
        return () => {
          listeners.delete(event_name);
        };
      },
    );

    const toolFn = build_channel(
      {
        ...context,
        request_queue: create_request_queue(log),
      },
      "document-event",
      (reply) => ({
        content: [{ type: "text", text: JSON.stringify(reply) }],
      }),
      {
        queue: true,
      },
    );

    const first = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );
    const second = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    await flushMicrotasks();
    expect(mockBus.send_to_extension).toHaveBeenCalledTimes(1);
    expect(listeners.has("document-event.first")).toBe(true);
    expect(listeners.has("document-event.second")).toBe(false);

    listeners.get("document-event.first")?.({
      __event: "document-event.first",
      ok: true,
    });

    await expect(first).resolves.toEqual({
      content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
    });
    await expect(second).rejects.toThrow(
      "Target document doc-1 is no longer connected; call list-documents and retry",
    );
    expect(mockBus.send_to_extension).toHaveBeenCalledTimes(2);
    expect(listeners.has("document-event.second")).toBe(false);
  });
});

describe("default_tool", () => {
  let mockBus: jest.Mocked<Bus>;
  let mockIdGenerator: { generate: jest.Mock<() => string> };
  let mockRequestQueue: { enqueue: jest.Mock<any> };
  let mockDocumentRouting: jest.Mocked<DocumentRouting>;
  const log = create_logger();
  let context: Context;

  beforeEach(() => {
    mockBus = {
      send_to_extension: jest.fn(),
      on_reply_from_extension: jest.fn((_, callback: BusListener<unknown>) => {
        callback({ test: "data" });
        return jest.fn();
      }),
    } as unknown as jest.Mocked<Bus>;

    mockIdGenerator = {
      generate: jest.fn<() => string>().mockReturnValue("789"),
    };

    mockRequestQueue = {
      enqueue: jest.fn((_: string, task: () => Promise<CallToolResult>) =>
        task(),
      ),
    };

    mockDocumentRouting = {
      list_documents: jest.fn(async () => []),
      resolve_target_document: jest.fn(async () => ({
        connection_id: "conn-1",
        target_document: { id: "doc-1" },
        document: {
          id: "doc-1",
          title: "Document One",
          mode: "local",
          hash: null,
          file_url: null,
          page_count: 1,
          current_page: {
            index: 0,
            id: "page-1",
            name: "Page 1",
            is_current: true,
          },
        },
      })),
    };

    context = {
      bus: mockBus,
      id_generator: mockIdGenerator,
      request_queue: mockRequestQueue,
      document_routing: mockDocumentRouting,
      log,
    };
  });

  it("should create a tool that returns JSON stringified response", async () => {
    const toolName = "default-tool";
    const tool = default_tool(toolName, context, { routing: "none" });

    const result = await tool(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({ test: "data" }),
        },
      ],
    });
  });

  it("should use the provided tool name in the channel", async () => {
    const toolName = "custom-tool";
    const tool = default_tool(toolName, context, { routing: "none" });

    await tool(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    expect(mockBus.send_to_extension).toHaveBeenCalledWith({
      __event: toolName,
      __request_id: "789",
    });
  });

  it("routes default tools through the resolved document by default", async () => {
    const tool = default_tool("custom-tool", context);

    await tool(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    expect(mockDocumentRouting.resolve_target_document).toHaveBeenCalledWith(
      {},
    );
    expect(mockBus.send_to_extension).toHaveBeenCalledWith({
      __event: "custom-tool",
      __request_id: "789",
      target_document: { id: "doc-1" },
      __target_connection_id: "conn-1",
    });
  });
});
