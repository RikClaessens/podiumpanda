import { describe, expect, it } from "vitest";
import { clampToneHz, frequencyToSlider, sliderToFrequency, stepTone } from "./tone-generator";
import { pitchReading } from "./tuner";

describe("tone generator pitch controls", () => {
  it("steps in equal temperament using the saved reference and transposed written notes", () => {
    const frequency = stepTone(442, 442, 1);
    expect(frequency).toBeCloseTo(442 * 2 ** (1 / 12), 10);
    expect(pitchReading(frequency, "bb", 442)).toMatchObject({ note: "C", octave: 5, cents: 0 });
    expect(stepTone(frequency, 442, -1)).toBeCloseTo(442, 10);
    expect(stepTone(20, 442, -1)).toBe(20);
    expect(stepTone(20000, 442, 1)).toBe(20000);
  });

  it("maps the logarithmic slider over the entire audible range", () => {
    expect(sliderToFrequency(0)).toBe(20);
    expect(sliderToFrequency(1000)).toBe(20000);
    expect(sliderToFrequency(frequencyToSlider(442))).toBeCloseTo(442, 10);
    expect(clampToneHz(1)).toBe(20);
    expect(clampToneHz(30000)).toBe(20000);
  });
});
