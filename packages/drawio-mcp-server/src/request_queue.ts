import type { Logger } from "./types.js";

export type RequestQueue = {
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
};

export function create_request_queue(log: Logger): RequestQueue {
  let tail = Promise.resolve();

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      const run = async () => {
        log.debug("[queue] starting queued request");
        try {
          return await task();
        } finally {
          log.debug("[queue] finished queued request");
        }
      };

      const result = tail.then(run, run);
      tail = result.then(
        () => undefined,
        () => undefined,
      );

      return result;
    },
  };
}
