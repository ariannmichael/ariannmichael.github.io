// Pure priority download queue (no three.js, no React). Lower priority number = more urgent.
//
// Why: the planet has ~250 unique models. Firing every request at once lets distant biomes compete
// with the spawn biome for bandwidth and main-thread parse time. The queue starts urgent work first
// and caps how many requests of each priority may be in flight, so background streaming trickles.

export interface LoadQueue {
  /**
   * Run `start` once for `key` (later calls share the first one's promise). A pending request is
   * promoted when asked for again with a more urgent priority. The promise always resolves (errors
   * are the caller's business: the component that renders the asset surfaces them).
   */
  request(key: string, start: (priority: number) => Promise<unknown>, priority: number): Promise<void>;
  /** True once `key` has finished (successfully or not) */
  isDone(key: string): boolean;
  /** Requests queued or in flight */
  pending(): number;
}

interface Entry {
  key: string;
  start: (priority: number) => Promise<unknown>;
  priority: number;
  seq: number;
  state: "queued" | "running" | "done";
  promise: Promise<void>;
  resolve: () => void;
}

/**
 * `limits[p]` = the most requests (of any priority) that may be in flight for a priority-`p` request
 * to start. Keep it non-increasing (e.g. [12, 6, 2]): urgent work gets every slot, background work
 * only starts when the pipe is nearly empty. Priorities past the end use the last limit.
 */
export function createLoadQueue(limits: readonly number[]): LoadQueue {
  const entries = new Map<string, Entry>();
  let running = 0;
  let seq = 0;

  const limitOf = (p: number) => limits[Math.min(Math.max(0, p), limits.length - 1)] ?? 1;

  function nextQueued(): Entry | undefined {
    let best: Entry | undefined;
    for (const e of entries.values()) {
      if (e.state !== "queued") continue;
      if (!best || e.priority < best.priority || (e.priority === best.priority && e.seq < best.seq)) best = e;
    }
    return best;
  }

  function pump(): void {
    for (;;) {
      const e = nextQueued();
      // Limits are non-increasing, so if the most urgent entry can't start, nothing else can
      if (!e || running >= limitOf(e.priority)) return;
      e.state = "running";
      running++;
      let p: Promise<unknown>;
      try {
        p = Promise.resolve(e.start(e.priority));
      } catch {
        p = Promise.resolve();
      }
      const finish = () => {
        e.state = "done";
        running--;
        e.resolve();
        pump();
      };
      p.then(finish, finish);
    }
  }

  return {
    request(key, start, priority) {
      const existing = entries.get(key);
      if (existing) {
        if (existing.state === "queued" && priority < existing.priority) {
          existing.priority = priority;
          pump();
        }
        return existing.promise;
      }
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      entries.set(key, { key, start, priority, seq: seq++, state: "queued", promise, resolve });
      pump();
      return promise;
    },
    isDone(key) {
      return entries.get(key)?.state === "done";
    },
    pending() {
      let n = 0;
      for (const e of entries.values()) if (e.state !== "done") n++;
      return n;
    },
  };
}
