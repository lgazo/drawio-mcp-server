import { describe, expect, it } from "@jest/globals";

import { create_request_queue } from "./request_queue.js";
import { create_logger } from "./standard_console_logger.js";

describe("request queue", () => {
  it("runs enqueued tasks in FIFO order", async () => {
    const queue = create_request_queue(create_logger());
    const steps: string[] = [];
    let releaseFirst!: () => void;

    const first = queue.enqueue(async () => {
      steps.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      steps.push("first:end");
      return "first";
    });

    const second = queue.enqueue(async () => {
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

    const first = queue.enqueue(async () => {
      steps.push("first");
      throw new Error("boom");
    });

    const second = queue.enqueue(async () => {
      steps.push("second");
      return "ok";
    });

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
    expect(steps).toEqual(["first", "second"]);
  });
});
