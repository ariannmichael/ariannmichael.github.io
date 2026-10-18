import { describe, expect, it } from "vitest";
import { createLoadQueue } from "./loadQueue";

/** A start function whose promise we settle by hand, recording start order. */
function harness() {
  const started: string[] = [];
  const settle = new Map<string, () => void>();
  const job = (key: string) => () => {
    started.push(key);
    return new Promise<void>((r) => settle.set(key, r));
  };
  return { started, settle, job };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createLoadQueue", () => {
  it("caps requests in flight by priority", () => {
    const q = createLoadQueue([2, 1]);
    const h = harness();
    for (const k of ["a", "b", "c"]) q.request(k, h.job(k), 0);
    expect(h.started).toEqual(["a", "b"]);
    expect(q.pending()).toBe(3);
  });

  it("starts the most urgent queued request first, FIFO within a priority", async () => {
    const q = createLoadQueue([1]);
    const h = harness();
    q.request("first", h.job("first"), 0);
    q.request("far1", h.job("far1"), 2);
    q.request("far2", h.job("far2"), 2);
    q.request("near", h.job("near"), 1);
    expect(h.started).toEqual(["first"]);
    h.settle.get("first")!();
    await flush();
    expect(h.started).toEqual(["first", "near"]);
    h.settle.get("near")!();
    await flush();
    expect(h.started).toEqual(["first", "near", "far1"]);
  });

  it("background work waits until the pipe is nearly empty", async () => {
    const q = createLoadQueue([3, 3, 1]);
    const h = harness();
    q.request("s1", h.job("s1"), 0);
    q.request("s2", h.job("s2"), 0);
    q.request("bg", h.job("bg"), 2);
    expect(h.started).toEqual(["s1", "s2"]);
    h.settle.get("s1")!();
    await flush();
    expect(h.started).toEqual(["s1", "s2"]);
    h.settle.get("s2")!();
    await flush();
    expect(h.started).toEqual(["s1", "s2", "bg"]);
  });

  it("dedupes by key and promotes a queued request", async () => {
    const q = createLoadQueue([1]);
    const h = harness();
    q.request("busy", h.job("busy"), 0);
    q.request("a", h.job("a"), 2);
    const p1 = q.request("b", h.job("b"), 2);
    const p2 = q.request("b", h.job("b-dup"), 1);
    expect(p2).toBe(p1);
    h.settle.get("busy")!();
    await flush();
    // "b" was promoted past "a"
    expect(h.started).toEqual(["busy", "b"]);
    expect(h.started).not.toContain("b-dup");
  });

  it("passes the current priority to start and resolves even when the job fails", async () => {
    const q = createLoadQueue([4]);
    let seen = -1;
    const p = q.request(
      "x",
      (prio) => {
        seen = prio;
        return Promise.reject(new Error("404"));
      },
      1,
    );
    await expect(p).resolves.toBeUndefined();
    expect(seen).toBe(1);
    expect(q.isDone("x")).toBe(true);
    expect(q.pending()).toBe(0);
  });

  it("survives a start function that throws synchronously", async () => {
    const q = createLoadQueue([1]);
    const h = harness();
    const bad = q.request(
      "bad",
      () => {
        throw new Error("boom");
      },
      0,
    );
    q.request("next", h.job("next"), 0);
    await bad;
    await flush();
    expect(h.started).toEqual(["next"]);
  });
});
