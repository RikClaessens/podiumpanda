import { describe, expect, it } from "vitest";
import { detectPitch, isInstrumentId, parseReferenceHz, pitchReading } from "./tuner";

function tone(frequency: number, sampleRate = 48000, cents = 0) {
  const actual = frequency * 2 ** (cents / 1200);
  return Float32Array.from(
    { length: 8192 },
    (_, i) => 0.5 * Math.sin((2 * Math.PI * actual * i) / sampleRate),
  );
}

describe("chromatic tuner", () => {
  it("detects low and high sustained notes and rejects silence", () => {
    for (const frequency of [27.5, 65.41, 110, 440, 987.77, 2093, 4186]) {
      const detected = detectPitch(tone(frequency), 48000);
      expect(detected).not.toBeNull();
      expect(Math.abs(1200 * Math.log2(detected! / frequency))).toBeLessThan(5);
    }
    expect(detectPitch(new Float32Array(8192), 48000)).toBeNull();
  });

  it("reports cents and transposes written notes including their octaves", () => {
    expect(pitchReading(440 * 2 ** (-17 / 1200), "concert")).toMatchObject({
      note: "A",
      octave: 4,
      cents: -17,
    });
    expect(pitchReading(233.0819, "bb")).toMatchObject({ note: "C", octave: 4 });
    expect(pitchReading(155.5635, "eb-alto")).toMatchObject({ note: "C", octave: 4 });
    expect(pitchReading(116.5409, "bb-tenor")).toMatchObject({ note: "C", octave: 4 });
    expect(pitchReading(311.127, "eb-clarinet")).toMatchObject({ note: "C", octave: 4 });
    expect(isInstrumentId("unknown")).toBe(false);
  });

  it("uses a valid saved reference pitch", () => {
    expect(pitchReading(442, "concert", 442)).toMatchObject({ note: "A", octave: 4, cents: 0 });
    expect(pitchReading(440, "concert", 442).cents).toBe(-8);
    expect(parseReferenceHz("415")).toBe(415);
    expect(parseReferenceHz("399")).toBe(440);
    expect(parseReferenceHz("441.5")).toBe(440);
  });
});
