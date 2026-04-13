import { describe, expect, it } from "@jest/globals";

import { create_request_queue } from "./request_queue.js";
import { create_logger } from "./standard_console_logger.js";

describe("request queue", () => {
  function activeTailCount(queue: ReturnType<typeof create_request_queue>) {
    return (queue as ReturnType<typeof create_request_queue> & {
      _active_tail_count: () => number;
    })._active_tail_count();
  }

  it("runs enqueued tasks in FIFO order", async () => {
    const queue = create_request_queue(create_logger());
    const steps: string[] = [];
    let releaseFirst!: () => void;

    const first = queue.enqueue("alpha", async () => {
      steps.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      steps.push("first:end");
      return "first";
    });

    const second = queue.enqueue("alpha", async () => {
      steps.push("second:start");
      steps.push("second:end");
      return "second";
    });

    await Promise.resolve();
    expect(steps).toEqual(["first:start"]);

    releaseFirst();

    await expect(Promise.all([first, second])).resolves.toEqual([
      "first",
      "second",
    ]);
    expect(steps).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("continues processing after a rejected task", async () => {
    const queue = create_request_queue(create_logger());
    const steps: string[] = [];

    const first = queue.enqueue("alpha", async () => {
      steps.push("first");
      throw new Error("boom");
    });

    const second = queue.enqueue("alpha", async () => {
      steps.push("second");
      return "ok";
    });

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
    expect(steps).toEqual(["first", "second"]);
  });

  it("allows different queue keys to run independently", async () => {
    const queue = create_request_queue(create_logger());
    const steps: string[] = [];
    let releaseFirst!: () => void;

    const first = queue.enqueue("alpha", async () => {
      steps.push("alpha:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      steps.push("alpha:end");
      return "alpha";
    });

    const second = queue.enqueue("beta", async () => {
      steps.push("beta:start");
      steps.push("beta:end");
      return "beta";
    });

    await Promise.resolve();
    await expect(second).resolves.toBe("beta");
    expect(steps).toEqual(["alpha:start", "beta:start", "beta:end"]);

    releaseFirst();

    await expect(first).resolves.toBe("alpha");
    expect(steps).toEqual([
      "alpha:start",
      "beta:start",
      "beta:end",
      "alpha:end",
    ]);
  });

  it("cleans up finished queue keys", async () => {
    const queue = create_request_queue(create_logger());

    expect(activeTailCount(queue)).toBe(0);

    await expect(queue.enqueue("alpha", async () => "alpha")).resolves.toBe(
      "alpha",
    );
    await Promise.resolve();
    expect(activeTailCount(queue)).toBe(0);

    const first = queue.enqueue("alpha", async () => "first");
    const second = queue.enqueue("beta", async () => "second");
    await expect(Promise.all([first, second])).resolves.toEqual([
      "first",
      "second",
    ]);
    await Promise.resolve();
    expect(activeTailCount(queue)).toBe(0);
  });
});
