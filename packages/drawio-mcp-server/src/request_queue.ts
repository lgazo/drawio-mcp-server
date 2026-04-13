import type { Logger } from "./types.js";

export type RequestQueue = {
  enqueue: <T>(key: string, task: () => Promise<T>) => Promise<T>;
  _active_tail_count?: () => number;
};

export function create_request_queue(log: Logger): RequestQueue {
  const tails = new Map<string, Promise<void>>();

  return {
    enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
      const run = async () => {
        log.debug(`[queue] starting queued request on ${key}`);
        try {
          return await task();
        } finally {
          log.debug(`[queue] finished queued request on ${key}`);
        }
      };

      const tail = tails.get(key) ?? Promise.resolve();
      const result = tail.then(run, run);
      const nextTail = result.then(
        () => undefined,
        () => undefined,
      );
      tails.set(key, nextTail);
      nextTail.finally(() => {
        if (tails.get(key) === nextTail) {
          tails.delete(key);
        }
      });

      return result;
    },
    _active_tail_count(): number {
      return tails.size;
    },
  };
}
