export const MAX_BARS = 2000;
export const MAX_COUNT_IN = 8;
export const MAX_HOLD = 60;
export const DEFAULT_HOLD = 2;
export const UNITS = [1, 2, 4, 8, 16, 32] as const;

// bpm is always quarter notes per minute; clicks fall on every beat of the time signature's unit.
export type Section = {
  bar: number;
  beats: number;
  unit: number;
  bpm: number;
  // Linear ramp that reaches endBpm at the start of the next section (or the end of the track).
  endBpm?: number;
};
// Holds the given beat (1-based) for this many extra seconds before the next click.
export type Fermata = { bar: number; beat: number; seconds: number };
export type ClickTrack = {
  title: string;
  countIn: number;
  bars: number;
  sections: Section[];
  fermatas?: Fermata[];
};
export type BarPlan = {
  bar: number;
  beats: number;
  unit: number;
  startBpm: number;
  endBpm: number;
  holds?: Record<number, number>;
};
// index points into expandBars(), which also tells the count-in bars apart.
export type Click = {
  time: number;
  accent: boolean;
  bar: number;
  beat: number;
  bpm: number;
  index: number;
};

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function validateTrack(track: ClickTrack): string | null {
  if (!Number.isInteger(track.bars) || track.bars < 1 || track.bars > MAX_BARS)
    return `The track needs between 1 and ${MAX_BARS} bars.`;
  if (!Number.isInteger(track.countIn) || track.countIn < 0 || track.countIn > MAX_COUNT_IN)
    return `The count-in must be between 0 and ${MAX_COUNT_IN} bars.`;
  if (!track.sections.length || track.sections[0].bar !== 1)
    return "The first section must start at bar 1.";
  for (const [index, section] of track.sections.entries()) {
    if (index > 0 && section.bar <= track.sections[index - 1].bar)
      return "Sections must be in increasing bar order.";
    if (section.bar > track.bars) return `Bar ${section.bar} is beyond the end of the track.`;
    if (!Number.isInteger(section.beats) || section.beats < 1 || section.beats > 32)
      return `Bar ${section.bar}: beats per bar must be between 1 and 32.`;
    if (!(UNITS as readonly number[]).includes(section.unit))
      return `Bar ${section.bar}: the beat unit must be 1, 2, 4, 8, 16 or 32.`;
    for (const bpm of [section.bpm, section.endBpm ?? section.bpm])
      if (!Number.isFinite(bpm) || bpm < 1 || bpm > 999)
        return `Bar ${section.bar}: the tempo must be between 1 and 999.`;
  }
  const seen = new Set<string>();
  for (const fermata of track.fermatas ?? []) {
    const where = `Fermata on bar ${fermata.bar}, beat ${fermata.beat}`;
    if (!Number.isInteger(fermata.bar) || fermata.bar < 1 || fermata.bar > track.bars)
      return `${where}: the bar must be between 1 and ${track.bars}.`;
    const section = [...track.sections].reverse().find((item) => item.bar <= fermata.bar)!;
    if (!Number.isInteger(fermata.beat) || fermata.beat < 1 || fermata.beat > section.beats)
      return `${where}: the beat must be between 1 and ${section.beats}.`;
    if (!Number.isFinite(fermata.seconds) || fermata.seconds <= 0 || fermata.seconds > MAX_HOLD)
      return `${where}: the hold must be between 0 and ${MAX_HOLD} seconds.`;
    const key = `${fermata.bar}.${fermata.beat}`;
    if (seen.has(key)) return `${where}: this beat already has a fermata.`;
    seen.add(key);
  }
  return null;
}

export function expandBars(track: ClickTrack, { countIn = true } = {}): BarPlan[] {
  const plans: BarPlan[] = [];
  const first = track.sections[0];
  if (countIn)
    for (let index = 0; index < track.countIn; index++)
      plans.push({
        bar: 0,
        beats: first.beats,
        unit: first.unit,
        startBpm: first.bpm,
        endBpm: first.bpm,
      });
  let sectionIndex = 0;
  for (let bar = 1; bar <= track.bars; bar++) {
    while (sectionIndex + 1 < track.sections.length && track.sections[sectionIndex + 1].bar <= bar)
      sectionIndex++;
    const section = track.sections[sectionIndex];
    const next = track.sections[sectionIndex + 1]?.bar ?? track.bars + 1;
    const length = next - section.bar;
    const target = section.endBpm ?? section.bpm;
    const holds: Record<number, number> = {};
    for (const fermata of track.fermatas ?? [])
      if (fermata.bar === bar) holds[fermata.beat - 1] = fermata.seconds;
    plans.push({
      bar,
      beats: section.beats,
      unit: section.unit,
      startBpm: lerp(section.bpm, target, (bar - section.bar) / length),
      endBpm: lerp(section.bpm, target, (bar + 1 - section.bar) / length),
      ...(Object.keys(holds).length ? { holds } : {}),
    });
  }
  return plans;
}

export function beatSeconds(plan: BarPlan, beat: number) {
  const bpm = lerp(plan.startBpm, plan.endBpm, beat / plan.beats);
  return ((60 / bpm) * 4) / plan.unit + (plan.holds?.[beat] ?? 0);
}

export function clickTimes(track: ClickTrack, options?: { countIn?: boolean }): Click[] {
  const clicks: Click[] = [];
  let time = 0;
  for (const [index, plan] of expandBars(track, options).entries()) {
    for (let beat = 0; beat < plan.beats; beat++) {
      const bpm = lerp(plan.startBpm, plan.endBpm, beat / plan.beats);
      clicks.push({ time, accent: beat === 0, bar: plan.bar, beat, bpm, index });
      time += beatSeconds(plan, beat);
    }
  }
  return clicks;
}

export function trackSeconds(track: ClickTrack, options?: { countIn?: boolean }) {
  let seconds = 0;
  for (const plan of expandBars(track, options))
    for (let beat = 0; beat < plan.beats; beat++) seconds += beatSeconds(plan, beat);
  return seconds;
}

// Merges per-bar tempos into sections, detecting linear ramps of three or more bars.
export function sectionsFromBars(
  bars: readonly { beats: number; unit: number; bpm: number }[],
): Section[] {
  const sections: Section[] = [];
  let index = 0;
  const sameSignature = (a: number, b: number) =>
    bars[a].beats === bars[b].beats && bars[a].unit === bars[b].unit;
  const push = (start: number, bpm: number, endBpm?: number) => {
    const previous = sections[sections.length - 1];
    const bar = start + 1;
    const { beats, unit } = bars[start];
    if (
      previous &&
      previous.endBpm === undefined &&
      endBpm === undefined &&
      previous.beats === beats &&
      previous.unit === unit &&
      previous.bpm === bpm
    )
      return;
    sections.push({ bar, beats, unit, bpm, ...(endBpm === undefined ? {} : { endBpm }) });
  };
  while (index < bars.length) {
    const step =
      index + 1 < bars.length && sameSignature(index, index + 1)
        ? bars[index + 1].bpm - bars[index].bpm
        : 0;
    let last = index;
    if (step !== 0)
      while (
        last + 1 < bars.length &&
        sameSignature(index, last + 1) &&
        Math.abs(bars[last + 1].bpm - bars[last].bpm - step) <= 1.01
      )
        last++;
    const previous = sections[sections.length - 1];
    const continuesConstant =
      previous !== undefined &&
      previous.endBpm === undefined &&
      previous.bpm === bars[index].bpm &&
      previous.beats === bars[index].beats &&
      previous.unit === bars[index].unit;
    if (step !== 0 && last - index >= 2 && continuesConstant) {
      // Keep this bar at the previous tempo and start the ramp on the first bar that changes.
      push(index, bars[index].bpm);
      index++;
    } else if (step !== 0 && last - index >= 2) {
      push(index, bars[index].bpm, round2(bars[last].bpm + step));
      index = last + 1;
    } else {
      push(index, bars[index].bpm);
      index++;
    }
  }
  return sections;
}

const formatNumber = (value: number) => String(round2(value));

export function formatTrackText(track: ClickTrack) {
  const lines = [
    `title: ${track.title}`,
    `count-in: ${track.countIn}`,
    `bars: ${track.bars}`,
    "",
    "# bar  signature  quarter-note bpm (use 96->72 for a gradual change up to the next row)",
  ];
  for (const section of track.sections)
    lines.push(
      `${section.bar}  ${section.beats}/${section.unit}  ${formatNumber(section.bpm)}${
        section.endBpm === undefined ? "" : `->${formatNumber(section.endBpm)}`
      }`,
    );
  if (track.fermatas?.length) {
    lines.push("", "# fermata: bar beat extra-seconds");
    for (const fermata of track.fermatas)
      lines.push(`fermata: ${fermata.bar} ${fermata.beat} ${formatNumber(fermata.seconds)}`);
  }
  return lines.join("\n");
}

const rowPattern = /^(\d+)\s+(\d+)\s*\/\s*(\d+)\s+(\d+(?:\.\d+)?)(?:\s*->\s*(\d+(?:\.\d+)?))?$/;

export function parseTrackText(text: string): { track: ClickTrack } | { error: string } {
  const track: ClickTrack = { title: "", countIn: 1, bars: 0, sections: [] };
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const fermata = /^fermata\s*:\s*(\d+)\s+(\d+)(?:\s+(\d+(?:\.\d+)?))?$/i.exec(line);
    if (fermata) {
      (track.fermatas ??= []).push({
        bar: Number(fermata[1]),
        beat: Number(fermata[2]),
        seconds: fermata[3] === undefined ? DEFAULT_HOLD : Number(fermata[3]),
      });
      continue;
    }
    const header = /^(title|count-in|bars)\s*:\s*(.*)$/i.exec(line);
    if (header) {
      const key = header[1].toLowerCase();
      if (key === "title") track.title = header[2].trim();
      else {
        const value = Number(header[2]);
        if (!Number.isInteger(value))
          return { error: `Line ${index + 1}: expected a whole number.` };
        if (key === "bars") track.bars = value;
        else track.countIn = value;
      }
      continue;
    }
    const row = rowPattern.exec(line);
    if (!row)
      return { error: `Line ${index + 1}: use "bar beats/unit bpm", for example "1 4/4 96".` };
    track.sections.push({
      bar: Number(row[1]),
      beats: Number(row[2]),
      unit: Number(row[3]),
      bpm: Number(row[4]),
      ...(row[5] === undefined ? {} : { endBpm: Number(row[5]) }),
    });
  }
  const error = validateTrack(track);
  return error ? { error } : { track };
}

export function clickAtSeconds(clicks: readonly Click[], seconds: number): Click | undefined {
  let low = 0;
  let high = clicks.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (clicks[middle].time <= seconds) low = middle;
    else high = middle - 1;
  }
  return clicks[low];
}

export function barAtSeconds(clicks: readonly Click[], seconds: number) {
  return clickAtSeconds(clicks, seconds)?.bar ?? 0;
}

export const EXAMPLE_TRACK_TEXT = `title: Example with every feature
count-in: 2
bars: 28

# Steady 4/4 at 96 quarter notes per minute
1  4/4  96
# Waltz time
5  3/4  120
# Compound meter: six eighth-note clicks per bar
9  6/8  100
# Gradual speed-up: bars 13-20 ramp from 100 to 140
13  4/4  100->140
# Odd meter, steady again
21  5/4  140
# Slow down to the end
25  4/4  140->80

# Fermatas: hold a beat for extra seconds before the next click
fermata: 8 3 2
fermata: 28 4 3
`;
