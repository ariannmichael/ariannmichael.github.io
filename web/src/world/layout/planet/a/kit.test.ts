import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { rotateLocal, yawToward } from "./kit";

describe("agent A authoring kit", () => {
  it("rotateLocal / yawToward follow the frame convention (+X is west at yaw 0)", () => {
    expect(rotateLocal(0, 1, 0)).toEqual([1, -0]);
    expect(rotateLocal(1, 0, 0)[1]).toBeCloseTo(-1);
    const [n, e] = rotateLocal(0, 1, yawToward(0, 1));
    expect(n).toBeCloseTo(0);
    expect(e).toBeCloseTo(1);
  });
});
