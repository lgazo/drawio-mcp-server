import { describe, it, expect, jest } from "@jest/globals";
import EventEmitter from "node:events";
import { create_bus } from "./emitter_bus.js";
import { bus_request_stream, bus_reply_stream, Bus } from "./types.js";
import { create_logger } from "./standard_console_logger.js";

describe("create_bus", () => {
  let emitter: EventEmitter;
  let bus: Bus;
  const log = create_logger();

  beforeEach(() => {
    emitter = new EventEmitter();
    bus = create_bus(log)(emitter);
  });

  it("should send requests to extension via emitter", () => {
    const mockRequest = { type: "test_request", data: "test" };
    const emitSpy = jest.spyOn(emitter, "emit");

    bus.send_to_extension(mockRequest);

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, mockRequest);
  });

  it("should register reply handlers and call them when matching events arrive", () => {
    const mockReply1 = jest.fn();
    const mockReply2 = jest.fn();
    const eventName1 = "event1";
    const eventName2 = "event2";
    const matchingEvent1 = { __event: eventName1, data: "test1" };
    const matchingEvent2 = { __event: eventName2, data: "test2" };
    const nonMatchingEvent = { __event: "other_event", data: "test3" };

    bus.on_reply_from_extension(eventName1, mockReply1);
    bus.on_reply_from_extension(eventName2, mockReply2);

    emitter.emit(bus_reply_stream, matchingEvent1);
    emitter.emit(bus_reply_stream, matchingEvent2);
    emitter.emit(bus_reply_stream, nonMatchingEvent);

    expect(mockReply1).toHaveBeenCalledWith(matchingEvent1);
    expect(mockReply2).toHaveBeenCalledWith(matchingEvent2);
    expect(mockReply1).not.toHaveBeenCalledWith(nonMatchingEvent);
    expect(mockReply2).not.toHaveBeenCalledWith(nonMatchingEvent);
  });

  it("should track all registered listeners", () => {
    // This test assumes the listeners array is accessible or there's a way to verify listeners
    // Since the original code doesn't expose the listeners array, we'll test indirectly
    const mockReply1 = jest.fn();
    const mockReply2 = jest.fn();

    bus.on_reply_from_extension("event1", mockReply1);
    bus.on_reply_from_extension("event2", mockReply2);

    // Verify listeners are working by emitting events
    const event1 = { __event: "event1", data: "test" };
    const event2 = { __event: "event2", data: "test" };

    emitter.emit(bus_reply_stream, event1);
    emitter.emit(bus_reply_stream, event2);

    expect(mockReply1).toHaveBeenCalledWith(event1);
    expect(mockReply2).toHaveBeenCalledWith(event2);
  });

  it("should only call the correct reply handler for each event", () => {
    const mockReply1 = jest.fn();
    const mockReply2 = jest.fn();
    const eventName1 = "event1";
    const eventName2 = "event2";
    const matchingEvent = { __event: eventName1, data: "test" };

    bus.on_reply_from_extension(eventName1, mockReply1);
    bus.on_reply_from_extension(eventName2, mockReply2);

    emitter.emit(bus_reply_stream, matchingEvent);

    expect(mockReply1).toHaveBeenCalledWith(matchingEvent);
    expect(mockReply2).not.toHaveBeenCalled();
  });
});
