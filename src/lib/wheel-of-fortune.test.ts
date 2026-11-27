import { describe, expect, it } from "vitest";
import {
  nextWheelRotation,
  wheelBoundaryIndex,
  wheelEntries,
  wheelRotationForIndex,
  wheelSlicePath,
  wheelStateSchema,
} from "./wheel-of-fortune";

describe("wheel of fortune", () => {
  it("uses nonempty trimmed lines, including repeated entries", () => {
    expect(wheelEntries(" Alex \n\nSam\r\nAlex \n")).toEqual(["Alex", "Sam", "Alex"]);
  });

  it("lands the selected segment under the pointer after multiple full rotations", () => {
    for (const count of [1, 2, 3, 7]) {
      for (let index = 0; index < count; index++) {
        const current = 2197;
        const rotation = nextWheelRotation(current, index, count);
        expect(rotation - current).toBeGreaterThanOrEqual(2520);
        const remainder = (((rotation - wheelRotationForIndex(index, count)) % 360) + 360) % 360;
        expect(Math.min(remainder, 360 - remainder)).toBeCloseTo(0);
      }
    }
  });

  it("draws a complete disk for one entry and half disks for two", () => {
    expect(wheelSlicePath(0, 1)).toContain("A 168 168 0 1 1");
    expect(wheelSlicePath(0, 2)).toContain("A 168 168 0 0 1");
    expect(wheelSlicePath(1, 2)).not.toBe(wheelSlicePath(0, 2));
  });

  it("rejects saved results that no longer correspond to an entry", () => {
    expect(wheelStateSchema.safeParse({ entries: "A\n\nB", selectedIndex: 1 }).success).toBe(true);
    expect(wheelStateSchema.safeParse({ entries: "A\n\nB", selectedIndex: 2 }).success).toBe(false);
    expect(wheelStateSchema.safeParse({ entries: "", selectedIndex: null }).success).toBe(true);
  });

  it("counts segment boundaries relative to the pointer, including negative rotations", () => {
    expect([44, 46, 134, 136].map((angle) => wheelBoundaryIndex(angle, 4))).toEqual([0, 1, 1, 2]);
    expect([0, -44, -46].map((angle) => wheelBoundaryIndex(angle, 4))).toEqual([0, 0, -1]);
  });

  it("restores older saved wheels with sound enabled", () => {
    expect(wheelStateSchema.parse({ entries: "A", selectedIndex: 0 }).muted).toBe(false);
    expect(wheelStateSchema.parse({ entries: "A", selectedIndex: 0, muted: true }).muted).toBe(
      true,
    );
  });
});
