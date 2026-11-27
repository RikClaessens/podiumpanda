import { describe, expect, it } from "vitest";
import {
  barAtSeconds,
  EXAMPLE_TRACK_TEXT,
  clickTimes,
  formatTrackText,
  parseTrackText,
  sectionsFromBars,
  trackSeconds,
  type ClickTrack,
} from "./click-track";
import { trackToMidi, trackToWav } from "./click-export";
import { importMidi } from "./click-import";

const track: ClickTrack = {
  title: "Test piece",
  countIn: 1,
  bars: 6,
  sections: [
    { bar: 1, beats: 4, unit: 4, bpm: 120 },
    { bar: 3, beats: 3, unit: 4, bpm: 90 },
    { bar: 5, beats: 6, unit: 8, bpm: 60, endBpm: 30 },
  ],
};

describe("click track timing", () => {
  it("places accented downbeats including the count-in", () => {
    const clicks = clickTimes(track);
    expect(clicks.slice(0, 5).map((click) => [click.bar, click.beat, click.accent])).toEqual([
      [0, 0, true],
      [0, 1, false],
      [0, 2, false],
      [0, 3, false],
      [1, 0, true],
    ]);
    expect(clicks[4].time).toBeCloseTo(2);
    expect(clickTimes(track).find((click) => click.bar === 5)?.time).toBeCloseTo(10);
    expect(trackSeconds(track, { countIn: false })).toBeGreaterThan(8);
  });

  it("slows down gradually across a ramp and finds the playing bar", () => {
    const clicks = clickTimes(track, { countIn: false });
    const rampBeats = clicks.filter((click) => click.bar >= 5);
    const gaps = rampBeats.slice(1).map((click, index) => click.time - rampBeats[index].time);
    expect(gaps.every((gap, index) => index === 0 || gap > gaps[index - 1])).toBe(true);
    expect(barAtSeconds(clicks, 4.2)).toBe(3);
  });
});

describe("click track text", () => {
  it("round trips and reports problems with a line number", () => {
    expect(parseTrackText(formatTrackText(track))).toEqual({ track });
    expect(parseTrackText("bars: 4\n1 4/4 abc")).toEqual({
      error: 'Line 2: use "bar beats/unit bpm", for example "1 4/4 96".',
    });
    expect(parseTrackText("bars: 4\n2 4/4 100")).toEqual({
      error: "The first section must start at bar 1.",
    });
  });

  it("merges identical bars and detects linear tempo ramps", () => {
    const bars = [100, 100, 100, 96, 92, 88, 84].map((bpm) => ({ beats: 4, unit: 4, bpm }));
    expect(sectionsFromBars(bars)).toEqual([
      { bar: 1, beats: 4, unit: 4, bpm: 100 },
      { bar: 4, beats: 4, unit: 4, bpm: 96, endBpm: 80 },
    ]);
  });
});

describe("exports", () => {
  it("writes MIDI that imports back to the same sections", () => {
    const imported = importMidi(trackToMidi({ ...track, countIn: 0 }));
    expect(imported.bars).toBe(6);
    expect(imported.sections.slice(0, 2)).toEqual(track.sections.slice(0, 2));
    expect(imported.sections[2]).toMatchObject({ bar: 5, beats: 6, unit: 8 });
  });

  it("writes a mono 16-bit WAV of the right length", () => {
    const wav = trackToWav({ ...track, bars: 1, sections: [track.sections[0]], countIn: 0 }, 8000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(wav.length).toBeGreaterThan(2 * 8000 * 2);
  });
});

describe("example track", () => {
  it("parses and uses every feature", () => {
    const parsed = parseTrackText(EXAMPLE_TRACK_TEXT);
    if (!("track" in parsed)) throw new Error(parsed.error);
    expect(parsed.track.countIn).toBe(2);
    expect(parsed.track.sections.some((section) => section.endBpm !== undefined)).toBe(true);
    expect(new Set(parsed.track.sections.map((section) => section.unit))).toEqual(new Set([4, 8]));
  });
});

describe("fermatas", () => {
  const base = "bars: 4\ncount-in: 0\n1 4/4 120\n";
  it("delays the following click and survives a text round trip", () => {
    const parsed = parseTrackText(`${base}fermata: 2 4 1.5`);
    if (!("track" in parsed)) throw new Error(parsed.error);
    const clicks = clickTimes(parsed.track);
    expect(clicks[8].time - clicks[7].time).toBeCloseTo(0.5 + 1.5);
    expect(clicks[9].time - clicks[8].time).toBeCloseTo(0.5);
    expect(trackSeconds(parsed.track)).toBeCloseTo(8 + 1.5);
    expect(parseTrackText(formatTrackText(parsed.track))).toEqual(parsed);
  });
  it("rejects fermatas outside the track", () => {
    expect(parseTrackText(`${base}fermata: 2 5 1`)).toHaveProperty("error");
    expect(parseTrackText(`${base}fermata: 9 1 1`)).toHaveProperty("error");
  });
});
