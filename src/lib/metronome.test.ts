import { describe, expect, it } from "vitest";
import {
  calculateTapTempo,
  clampBeatsPerBar,
  clampBpm,
  MAX_BEATS_PER_BAR,
  MAX_BPM,
  MIN_BEATS_PER_BAR,
  MIN_BPM,
  subdivisionIntervalSeconds,
} from "./metronome";

describe("metronome tempo", () => {
  it("calculates a rounded tempo from tap intervals", () => {
    expect(calculateTapTempo([0, 500, 1002, 1500])).toBe(120);
  });

  it("returns no tempo until there are two valid taps", () => {
    expect(calculateTapTempo([])).toBeNull();
    expect(calculateTapTempo([100])).toBeNull();
    expect(calculateTapTempo([100, 100])).toBeNull();
  });

  it("keeps the tempo within the supported range", () => {
    expect(clampBpm(10)).toBe(MIN_BPM);
    expect(clampBpm(400)).toBe(MAX_BPM);
    expect(calculateTapTempo([0, 1])).toBe(MAX_BPM);
  });

  it("supports bars with one through sixteen beats", () => {
    expect(clampBeatsPerBar(0)).toBe(MIN_BEATS_PER_BAR);
    expect(clampBeatsPerBar(17)).toBe(MAX_BEATS_PER_BAR);
    expect(clampBeatsPerBar(8.6)).toBe(9);
  });

  it("places each subdivision evenly within the beat", () => {
    expect(subdivisionIntervalSeconds(120, 4, 1)).toBe(0.5);
    expect(subdivisionIntervalSeconds(120, 4, 2)).toBe(0.25);
    expect(subdivisionIntervalSeconds(120, 4, 7)).toBeCloseTo(0.5 / 7);
  });
});
