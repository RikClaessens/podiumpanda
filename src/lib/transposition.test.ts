import { describe, expect, it } from "vitest";
import { formatNote, transposeByOffsets, transposeNote } from "./transposition";
import { instruments } from "./tuner";

describe("instrument transposition", () => {
  it("converts written notes through concert pitch, including octave transpositions", () => {
    expect(transposeNote(60, "bb", "eb-alto")).toEqual({ concert: 58, result: 67 });
    expect(transposeNote(60, "bb-tenor", "eb-baritone")).toEqual({ concert: 46, result: 67 });
    expect(transposeNote(60, "eb-clarinet", "f-horn")).toEqual({ concert: 63, result: 70 });
    expect(transposeNote(60, "piccolo", "glockenspiel")).toEqual({ concert: 72, result: 48 });
    expect(transposeNote(60, "guitar", "a-clarinet")).toEqual({ concert: 48, result: 51 });
  });

  it("round trips all supported instruments and preserves identical parts", () => {
    for (const from of instruments) {
      for (const to of instruments) {
        const result = transposeNote(60, from.id, to.id).result;
        expect(transposeNote(result, to.id, from.id).result).toBe(60);
        if (from.id === to.id) expect(result).toBe(60);
      }
    }
  });

  it("labels both enharmonic names with their octave, including below C0", () => {
    expect(formatNote(60)).toBe("C4");
    expect(formatNote(58)).toBe("A♯3 / B♭3");
    expect(formatNote(-1)).toBe("B-2");
    expect(formatNote(1)).toBe("C♯-1 / D♭-1");
  });

  it("supports custom instrument intervals in either direction", () => {
    expect(transposeByOffsets(60, -5, 14)).toEqual({ concert: 65, result: 79 });
    expect(transposeByOffsets(79, 14, -5).result).toBe(60);
  });
});
