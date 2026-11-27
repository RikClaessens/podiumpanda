import {
  DEFAULT_CAESURA,
  DEFAULT_HOLD,
  MAX_BARS,
  MAX_COUNT_IN,
  MAX_HOLD,
  MAX_REPEATS,
  UNITS,
} from "./click-limits";
import { unrollDetailed, type ScoreMeasure } from "./click-structure";

export { DEFAULT_CAESURA, DEFAULT_HOLD, MAX_BARS, MAX_COUNT_IN, MAX_HOLD, MAX_REPEATS, UNITS };

// 0 is silent, 1 a normal click, 2 a medium accent and 3 the strong accent.
export type Level = 0 | 1 | 2 | 3;

// bpm is always quarter notes per minute. Clicks fall on every pulse of the bar, which is one beat
// of the time signature's unit unless `group` joins several units into one pulse (6/8 as 3+3).
export type Section = {
  bar: number;
  // Set on a tempo change in the middle of a bar: the 1-based pulse where the new tempo starts.
  beat?: number;
  beats: number;
  unit: number;
  bpm: number;
  // Linear ramp that reaches endBpm at the start of the next section (or the end of the track).
  endBpm?: number;
  group?: number[];
  // Extra soft clicks per pulse.
  sub?: number;
  // Percentage of a pulse taken by the first of two subdivisions (50 is straight, 67 is triplet swing).
  swing?: number;
  accent?: Level[];
};
// Holds the given pulse (1-based) for this many extra seconds before the next click.
export type Fermata = { bar: number; beat: number; seconds: number; caesura?: boolean };
export type Repeat = { from: number; to: number; times?: number };
export type Ending = { from: number; to: number; passes: number[] };
export type MarkKind = "segno" | "coda" | "tocoda" | "fine";
export type Marker = { bar: number; kind: MarkKind };
export type Jump = { bar: number; to: "start" | "segno"; until?: "fine" | "coda" };
export type ClickTrack = {
  title: string;
  countIn: number;
  bars: number;
  sections: Section[];
  fermatas?: Fermata[];
  repeats?: Repeat[];
  endings?: Ending[];
  marks?: Marker[];
  jumps?: Jump[];
};
export type BarPlan = {
  bar: number;
  beats: number;
  unit: number;
  startBpm: number;
  endBpm: number;
  // Whether the tempo glides during this bar (as opposed to jumping at a mid-bar tempo change).
  ramp: boolean;
  pulses: number[];
  accents: Level[];
  pulseBpm: number[];
  sub: number;
  swing: number;
  holds?: Record<number, number>;
  caesuras?: number[];
  changes?: { pulse: number; bpm: number }[];
  pass: number;
  passes: number;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  ending?: { passes: number[]; start: boolean; end: boolean };
  marks?: MarkKind[];
  jump?: Jump;
};
export type Pulse = {
  units: number;
  offset: number;
  seconds: number;
  level: Level;
  subOffsets: number[];
};
// index points into expandBars(), which also tells the count-in bars apart.
export type Click = {
  time: number;
  accent: boolean;
  level: Level;
  // 0 for the click on the pulse itself, 1 and up for the soft subdivisions.
  sub: number;
  bar: number;
  beat: number;
  bpm: number;
  index: number;
};

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const round2 = (value: number) => Math.round(value * 100) / 100;

export const pulseGroups = (section: Pick<Section, "beats" | "group">) =>
  section.group ?? Array.from({ length: section.beats }, () => 1);
export const pulseCount = (section: Pick<Section, "beats" | "group">) =>
  section.group?.length ?? section.beats;
export const unitOffsets = (groups: readonly number[]) => {
  let total = 0;
  return groups.map((units) => {
    const start = total;
    total += units;
    return start;
  });
};
export const defaultAccents = (count: number): Level[] =>
  Array.from({ length: count }, (_, index) => (index === 0 ? 3 : 1));
export const subdivisions = (section: Pick<Section, "sub" | "swing">) =>
  section.sub ?? (section.swing ? 2 : 1);

const isBase = (section: Section) => section.beat === undefined;
const baseBefore = (sections: readonly Section[], bar: number) =>
  [...sections].reverse().find((section) => isBase(section) && section.bar <= bar);

// The full section (time signature and feel) in force at each bar, 1-based.
function basesByBar(track: Pick<ClickTrack, "bars" | "sections">) {
  const bases: Section[] = [];
  const rows = track.sections.filter(isBase);
  let row = 0;
  for (let bar = 1; bar <= track.bars; bar++) {
    while (row + 1 < rows.length && rows[row + 1].bar <= bar) row++;
    bases[bar] = rows[row];
  }
  return bases;
}

type Segment = { x: number; bpm: number; endBpm: number };

// Positions are measured in bars, so bar 1 starts at 0 and a mid-bar change sits between bars.
function segmentsOf(track: Pick<ClickTrack, "bars" | "sections">, bases = basesByBar(track)) {
  return track.sections.map<Segment>((section) => {
    const base = bases[Math.min(track.bars, section.bar)] ?? section;
    const offsets = unitOffsets(pulseGroups(base));
    const fraction = section.beat === undefined ? 0 : (offsets[section.beat - 1] ?? 0) / base.beats;
    return {
      x: section.bar - 1 + fraction,
      bpm: section.bpm,
      endBpm: section.endBpm ?? section.bpm,
    };
  });
}

function segmentAt(segments: readonly Segment[], x: number) {
  let index = 0;
  while (index + 1 < segments.length && segments[index + 1].x <= x + 1e-9) index++;
  return index;
}

function bpmIn(segments: readonly Segment[], index: number, x: number, bars: number) {
  const segment = segments[index];
  const length = (segments[index + 1]?.x ?? bars) - segment.x;
  return length > 0 ? lerp(segment.bpm, segment.endBpm, (x - segment.x) / length) : segment.bpm;
}

export function tempoAtBar(track: Pick<ClickTrack, "bars" | "sections">, bar: number) {
  const segments = segmentsOf(track);
  return bpmIn(segments, segmentAt(segments, bar - 1), bar - 1, track.bars);
}

function measuresOf(track: ClickTrack): ScoreMeasure[] {
  const measures: ScoreMeasure[] = Array.from({ length: track.bars }, () => ({
    beats: 0,
    unit: 0,
    bpm: null,
    marks: [],
  }));
  for (const repeat of track.repeats ?? []) {
    if (measures[repeat.from - 1]) measures[repeat.from - 1].repeatStart = true;
    if (measures[repeat.to - 1]) measures[repeat.to - 1].repeatEnd = (repeat.times ?? 1) + 1;
  }
  for (const ending of track.endings ?? [])
    for (let bar = ending.from; bar <= ending.to; bar++)
      if (measures[bar - 1]) measures[bar - 1].volta = ending.passes;
  for (const mark of track.marks ?? []) measures[mark.bar - 1]?.marks.push(mark.kind);
  for (const jump of track.jumps ?? [])
    if (measures[jump.bar - 1])
      measures[jump.bar - 1].jump = {
        to: jump.to,
        until: jump.until === "fine" ? "fine" : jump.until === "coda" ? "tocoda" : undefined,
        continueAt: jump.until === "coda" ? "coda" : undefined,
      };
  return measures;
}

// The written bars in the order they are played, with the pass of the repeat they belong to.
export function playOrder(track: ClickTrack): { bar: number; pass: number }[] {
  if (!track.repeats?.length && !track.jumps?.length && !track.endings?.length)
    return Array.from({ length: track.bars }, (_, index) => ({ bar: index + 1, pass: 1 }));
  return unrollDetailed(measuresOf(track)).map(({ index, pass }) => ({ bar: index + 1, pass }));
}

const isWhole = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

function validateSection(section: Section, base: Section | undefined) {
  const where = `Bar ${section.bar}`;
  if (section.beat !== undefined) {
    if (!base || section.beats !== base.beats || section.unit !== base.unit)
      return `${where}: a tempo change inside a bar must keep the time signature.`;
    if (!isWhole(section.beat, 2, pulseCount(base)))
      return `${where}: the tempo change must fall on beat 2 to ${pulseCount(base)}.`;
  } else {
    if (!isWhole(section.beats, 1, 32)) return `${where}: beats per bar must be between 1 and 32.`;
    if (!(UNITS as readonly number[]).includes(section.unit))
      return `${where}: the beat unit must be 1, 2, 4, 8, 16 or 32.`;
    if (
      section.group &&
      (!section.group.length ||
        section.group.some((units) => !isWhole(units, 1, 32)) ||
        section.group.reduce((total, units) => total + units, 0) !== section.beats)
    )
      return `${where}: the groups must add up to ${section.beats}.`;
    if (section.sub !== undefined && !isWhole(section.sub, 1, 4))
      return `${where}: the subdivision must be between 1 and 4.`;
    if (section.swing !== undefined && !(section.swing >= 50 && section.swing <= 90))
      return `${where}: the swing must be between 50 and 90.`;
    if (
      section.accent &&
      (section.accent.length !== pulseCount(section) ||
        section.accent.some((level) => !isWhole(level, 0, 3)))
    )
      return `${where}: give ${pulseCount(section)} accent levels between 0 and 3.`;
  }
  for (const bpm of [section.bpm, section.endBpm ?? section.bpm])
    if (!Number.isFinite(bpm) || bpm < 1 || bpm > 999)
      return `${where}: the tempo must be between 1 and 999.`;
  return null;
}

export function validateTrack(track: ClickTrack): string | null {
  if (!Number.isInteger(track.bars) || track.bars < 1 || track.bars > MAX_BARS)
    return `The track needs between 1 and ${MAX_BARS} bars.`;
  if (!Number.isInteger(track.countIn) || track.countIn < 0 || track.countIn > MAX_COUNT_IN)
    return `The count-in must be between 0 and ${MAX_COUNT_IN} bars.`;
  if (!track.sections.length || track.sections[0].bar !== 1 || track.sections[0].beat !== undefined)
    return "The first section must start at bar 1.";
  let base: Section | undefined;
  for (const [index, section] of track.sections.entries()) {
    const previous = track.sections[index - 1];
    if (
      previous &&
      (section.bar < previous.bar ||
        (section.bar === previous.bar && (section.beat ?? 1) <= (previous.beat ?? 1)))
    )
      return "Sections must be in increasing bar order.";
    if (section.bar > track.bars) return `Bar ${section.bar} is beyond the end of the track.`;
    if (isBase(section)) base = section;
    const problem = validateSection(section, base);
    if (problem) return problem;
  }
  const bases = basesByBar(track);
  const seen = new Set<string>();
  for (const fermata of track.fermatas ?? []) {
    const label = fermata.caesura ? "Caesura" : "Fermata";
    const where = `${label} on bar ${fermata.bar}, beat ${fermata.beat}`;
    if (!isWhole(fermata.bar, 1, track.bars))
      return `${where}: the bar must be between 1 and ${track.bars}.`;
    const count = pulseCount(bases[fermata.bar]);
    if (!isWhole(fermata.beat, 1, count))
      return `${where}: the beat must be between 1 and ${count}.`;
    if (!Number.isFinite(fermata.seconds) || fermata.seconds <= 0 || fermata.seconds > MAX_HOLD)
      return `${where}: the hold must be between 0 and ${MAX_HOLD} seconds.`;
    const key = `${fermata.bar}.${fermata.beat}`;
    if (seen.has(key)) return `${where}: this beat already has a fermata.`;
    seen.add(key);
  }
  const repeats = [...(track.repeats ?? [])].sort((a, b) => a.from - b.from);
  for (const [index, repeat] of repeats.entries()) {
    if (!isWhole(repeat.from, 1, track.bars) || !isWhole(repeat.to, repeat.from, track.bars))
      return `Repeat ${repeat.from}-${repeat.to}: use bars between 1 and ${track.bars}.`;
    if (repeat.times !== undefined && !isWhole(repeat.times, 1, MAX_REPEATS))
      return `Repeat ${repeat.from}-${repeat.to}: repeat 1 to ${MAX_REPEATS} times.`;
    if (index > 0 && repeat.from <= repeats[index - 1].to)
      return "Repeats cannot overlap or be nested.";
  }
  for (const ending of track.endings ?? []) {
    if (!isWhole(ending.from, 1, track.bars) || !isWhole(ending.to, ending.from, track.bars))
      return `Ending ${ending.from}-${ending.to}: use bars between 1 and ${track.bars}.`;
    if (!ending.passes.length || ending.passes.some((pass) => !isWhole(pass, 1, MAX_REPEATS + 1)))
      return `Ending ${ending.from}: give the passes it is played on, for example 1 or 1,2.`;
  }
  const kinds = new Set<MarkKind>();
  for (const mark of track.marks ?? []) {
    if (!isWhole(mark.bar, 1, track.bars))
      return `The ${mark.kind} mark needs a bar between 1 and ${track.bars}.`;
    if (kinds.has(mark.kind)) return `There can only be one ${mark.kind} mark.`;
    kinds.add(mark.kind);
  }
  for (const jump of track.jumps ?? []) {
    const name = jump.to === "start" ? "D.C." : "D.S.";
    if (!isWhole(jump.bar, 1, track.bars))
      return `${name} needs a bar between 1 and ${track.bars}.`;
    if (jump.to === "segno" && !kinds.has("segno")) return `${name} needs a segno mark.`;
    if (jump.until === "fine" && !kinds.has("fine")) return `${name} al fine needs a fine mark.`;
    if (jump.until === "coda" && !(kinds.has("coda") && kinds.has("tocoda")))
      return `${name} al coda needs a tocoda and a coda mark.`;
  }
  if ((track.jumps?.length ?? 0) > 4) return "Use at most 4 D.C. or D.S. jumps.";
  if (playOrder(track).length > MAX_BARS * 2) return "The repeats make this track too long.";
  return null;
}

export function expandBars(track: ClickTrack, { countIn = true } = {}): BarPlan[] {
  const plans: BarPlan[] = [];
  const bases = basesByBar(track);
  const segments = segmentsOf(track, bases);
  const first = bases[1];
  if (countIn) {
    const groups = pulseGroups(first);
    for (let index = 0; index < track.countIn; index++)
      plans.push({
        bar: 0,
        beats: first.beats,
        unit: first.unit,
        startBpm: first.bpm,
        endBpm: first.bpm,
        ramp: false,
        pulses: groups,
        accents: first.accent ?? defaultAccents(groups.length),
        pulseBpm: groups.map(() => first.bpm),
        sub: 1,
        swing: 50,
        pass: 1,
        passes: 1,
      });
  }
  for (const { bar, pass } of playOrder(track)) {
    const base = bases[bar];
    const pulses = pulseGroups(base);
    const offsets = unitOffsets(pulses);
    const where = offsets.map((offset) => bar - 1 + offset / base.beats);
    const owners = where.map((x) => segmentAt(segments, x));
    const pulseBpm = where.map((x, index) => bpmIn(segments, owners[index], x, track.bars));
    const holds: Record<number, number> = {};
    const caesuras: number[] = [];
    for (const fermata of track.fermatas ?? [])
      if (fermata.bar === bar && fermata.beat >= 1 && fermata.beat <= pulses.length) {
        holds[fermata.beat - 1] = fermata.seconds;
        if (fermata.caesura) caesuras.push(fermata.beat - 1);
      }
    const changes = pulseBpm
      .map((bpm, pulse) => ({ pulse, bpm }))
      .filter((change) => change.pulse > 0 && owners[change.pulse] !== owners[change.pulse - 1]);
    const repeat = track.repeats?.find((item) => item.from <= bar && bar <= item.to);
    const ending = track.endings?.find((item) => item.from <= bar && bar <= item.to);
    const marks = (track.marks ?? []).filter((item) => item.bar === bar).map((item) => item.kind);
    const jump = track.jumps?.find((item) => item.bar === bar);
    const sub = subdivisions(base);
    plans.push({
      bar,
      beats: base.beats,
      unit: base.unit,
      startBpm: pulseBpm[0],
      endBpm: bpmIn(segments, owners[owners.length - 1], bar, track.bars),
      ramp: owners.some((owner) => segments[owner].endBpm !== segments[owner].bpm),
      pulses,
      accents: base.accent ?? defaultAccents(pulses.length),
      pulseBpm,
      sub,
      swing: sub === 2 ? (base.swing ?? 50) : 50,
      pass,
      passes: repeat ? (repeat.times ?? 1) + 1 : 1,
      ...(Object.keys(holds).length ? { holds } : {}),
      ...(caesuras.length ? { caesuras } : {}),
      ...(changes.length ? { changes } : {}),
      ...(repeat?.from === bar ? { repeatStart: true } : {}),
      ...(repeat?.to === bar ? { repeatEnd: true } : {}),
      ...(ending
        ? { ending: { passes: ending.passes, start: ending.from === bar, end: ending.to === bar } }
        : {}),
      ...(marks.length ? { marks } : {}),
      ...(jump ? { jump } : {}),
    });
  }
  return plans;
}

const pulseBaseSeconds = (plan: BarPlan, pulse: number) =>
  ((60 / plan.pulseBpm[pulse]) * 4 * plan.pulses[pulse]) / plan.unit;

export function beatSeconds(plan: BarPlan, beat: number) {
  return pulseBaseSeconds(plan, beat) + (plan.holds?.[beat] ?? 0);
}

export function barPulses(plan: BarPlan): Pulse[] {
  let offset = 0;
  return plan.pulses.map((units, index) => {
    const base = pulseBaseSeconds(plan, index);
    const seconds = beatSeconds(plan, index);
    const pulse: Pulse = {
      units,
      offset,
      seconds,
      level: plan.accents[index] ?? 1,
      subOffsets: Array.from(
        { length: plan.sub - 1 },
        (_, step) => base * (plan.sub === 2 ? plan.swing / 100 : (step + 1) / plan.sub),
      ),
    };
    offset += seconds;
    return pulse;
  });
}

export function clickTimes(track: ClickTrack, options?: { countIn?: boolean }): Click[] {
  const clicks: Click[] = [];
  let time = 0;
  for (const [index, plan] of expandBars(track, options).entries()) {
    const pulses = barPulses(plan);
    for (const [beat, pulse] of pulses.entries()) {
      const at = time + pulse.offset;
      const common = { bar: plan.bar, beat, bpm: plan.pulseBpm[beat], index };
      clicks.push({ time: at, accent: pulse.level === 3, level: pulse.level, sub: 0, ...common });
      for (const [step, offset] of pulse.subOffsets.entries())
        clicks.push({ time: at + offset, accent: false, level: 1, sub: step + 1, ...common });
    }
    time += pulses.reduce((total, pulse) => total + pulse.seconds, 0);
  }
  return clicks;
}

export function trackSeconds(track: ClickTrack, options?: { countIn?: boolean }) {
  let seconds = 0;
  for (const plan of expandBars(track, options))
    for (let beat = 0; beat < plan.pulses.length; beat++) seconds += beatSeconds(plan, beat);
  return seconds;
}

export type BarInput = {
  beats: number;
  unit: number;
  bpm: number;
  group?: number[];
  // Swing as a percentage; imported swing is made audible with eighth-note subdivisions.
  swing?: number;
  // Tempo steps that start on a later pulse of the bar (1-based, at least 2).
  changes?: { beat: number; bpm: number }[];
};

// Merges per-bar tempos into sections, detecting linear ramps of three or more bars.
export function sectionsFromBars(bars: readonly BarInput[]): Section[] {
  const sections: Section[] = [];
  let index = 0;
  const signature = (bar: Pick<BarInput, "beats" | "unit" | "group" | "swing">) =>
    `${bar.beats}/${bar.unit}/${bar.group?.join("+") ?? ""}/${bar.swing ?? ""}`;
  const same = (a: number, b: number) => signature(bars[a]) === signature(bars[b]);
  const plain = (position: number) => !bars[position].changes?.length;
  const push = (start: number, bpm: number, endBpm?: number) => {
    const previous = sections[sections.length - 1];
    const { beats, unit, group, swing } = bars[start];
    if (
      previous &&
      previous.endBpm === undefined &&
      endBpm === undefined &&
      signature(previous) === signature(bars[start]) &&
      previous.bpm === bpm
    )
      return;
    sections.push({
      bar: start + 1,
      beats,
      unit,
      bpm,
      ...(endBpm === undefined ? {} : { endBpm }),
      ...(group ? { group } : {}),
      ...(swing ? { sub: 2, swing } : {}),
    });
  };
  while (index < bars.length) {
    const step =
      index + 1 < bars.length && same(index, index + 1) && plain(index) && plain(index + 1)
        ? bars[index + 1].bpm - bars[index].bpm
        : 0;
    let last = index;
    if (step !== 0)
      while (
        last + 1 < bars.length &&
        same(index, last + 1) &&
        plain(last + 1) &&
        Math.abs(bars[last + 1].bpm - bars[last].bpm - step) <= 1.01
      )
        last++;
    const previous = sections[sections.length - 1];
    const continuesConstant =
      previous !== undefined &&
      previous.endBpm === undefined &&
      previous.bpm === bars[index].bpm &&
      signature(previous) === signature(bars[index]);
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
  for (const [position, bar] of bars.entries())
    for (const change of bar.changes ?? []) {
      // The next bar usually restates the tempo this change arrived at.
      const next = sections.findIndex((item) => isBase(item) && item.bar === position + 2);
      if (
        next >= 0 &&
        sections[next].endBpm === undefined &&
        sections[next].bpm === change.bpm &&
        signature(sections[next]) === signature(bar)
      )
        sections.splice(next, 1);
      sections.push({
        bar: position + 1,
        beat: change.beat,
        beats: bar.beats,
        unit: bar.unit,
        bpm: change.bpm,
      });
    }
  return sections.sort((a, b) => a.bar - b.bar || (a.beat ?? 1) - (b.beat ?? 1));
}

export type TempoWord = {
  kind: "rit" | "accel" | "atempo";
  from: number;
  to?: number;
  // A tempo in quarter notes per minute, or a percentage of the starting tempo.
  target?: number;
  percent?: boolean;
  molto?: boolean;
};

const feelOf = (section: Section) => ({
  beats: section.beats,
  unit: section.unit,
  ...(section.group ? { group: section.group } : {}),
  ...(section.sub ? { sub: section.sub } : {}),
  ...(section.swing ? { swing: section.swing } : {}),
  ...(section.accent ? { accent: section.accent } : {}),
});

function insertSection(track: ClickTrack, section: Section) {
  const at = track.sections.findIndex(
    (item) => item.bar > section.bar || (item.bar === section.bar && !isBase(item)),
  );
  track.sections.splice(at < 0 ? track.sections.length : at, 0, section);
}

function setRow(track: ClickTrack, bar: number, tempo: Pick<Section, "bpm" | "endBpm">) {
  const existing = track.sections.findIndex((item) => isBase(item) && item.bar === bar);
  if (existing < 0) {
    insertSection(track, { ...feelOf(basesByBar(track)[bar]), bar, ...tempo });
    return;
  }
  const { endBpm: _ignored, ...rest } = track.sections[existing];
  track.sections[existing] = { ...rest, ...tempo };
}

// Rewrites rit., accel. and a tempo into ordinary tempo rows, so everything else sees plain sections.
// A lenient run skips words that do not fit instead of failing.
export function applyTempoWords(
  track: ClickTrack,
  words: readonly TempoWord[],
  { lenient = false } = {},
): string | null {
  let resume: number | null = null;
  const fail = (message: string) => (lenient ? null : message);
  for (const word of [...words].sort((a, b) => a.from - b.from)) {
    const name = word.kind === "atempo" ? "a tempo" : word.kind === "rit" ? "rit." : "accel.";
    if (!isWhole(word.from, 1, track.bars)) {
      if (lenient) continue;
      return `${name}: bar ${word.from} is beyond the end of the track.`;
    }
    if (word.kind === "atempo") {
      if (resume === null) {
        if (lenient) continue;
        return "a tempo needs a rit. or accel. before it.";
      }
      setRow(track, word.from, { bpm: resume });
      continue;
    }
    const to = word.to ?? word.from;
    const bases = basesByBar(track);
    const problem = !isWhole(to, word.from, track.bars)
      ? `${name}: use bars ${word.from} to ${track.bars}.`
      : bases[word.from].bar < word.from && bases[word.from].endBpm !== undefined
        ? `${name} cannot start inside a gradual tempo change.`
        : track.sections.some((section) => section.bar > word.from && section.bar <= to)
          ? `${name}: bars ${word.from}-${to} overlap another tempo change.`
          : null;
    if (problem) {
      const failure = fail(problem);
      if (failure) return failure;
      continue;
    }
    const base = round2(tempoAtBar(track, word.from));
    const factor = word.kind === "rit" ? (word.molto ? 0.6 : 0.75) : word.molto ? 1.5 : 1.25;
    const wanted =
      word.target === undefined
        ? base * factor
        : word.percent
          ? (base * word.target) / 100
          : word.target;
    const target = round2(Math.min(999, Math.max(1, wanted)));
    resume = base;
    const settles =
      to < track.bars && !track.sections.some((item) => isBase(item) && item.bar === to + 1);
    const feel = feelOf(bases[to]);
    setRow(track, word.from, { bpm: base, endBpm: target });
    if (settles) insertSection(track, { ...feel, bar: to + 1, bpm: target });
  }
  return null;
}

const formatNumber = (value: number) => String(round2(value));
const formatRange = (from: number, to: number) => (from === to ? String(from) : `${from}-${to}`);
const formatTempo = (bpm: number, endBpm?: number) =>
  `${formatNumber(bpm)}${endBpm === undefined ? "" : `->${formatNumber(endBpm)}`}`;

export function formatTrackText(track: ClickTrack) {
  const lines = [
    `title: ${track.title}`,
    `count-in: ${track.countIn}`,
    `bars: ${track.bars}`,
    "",
    "# bar  signature  quarter-note bpm (use 96->72 for a gradual change up to the next row)",
  ];
  for (const section of track.sections.filter(isBase))
    lines.push(
      [
        `${section.bar}  ${section.beats}/${section.unit}  ${formatTempo(section.bpm, section.endBpm)}`,
        section.group ? `group:${section.group.join("+")}` : "",
        section.sub ? `sub:${section.sub}` : "",
        section.swing ? `swing:${formatNumber(section.swing)}` : "",
        section.accent ? `accent:${section.accent.join(",")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  const changes = track.sections.filter((section) => !isBase(section));
  if (changes.length) {
    lines.push("", "# tempo: bar beat bpm (a tempo change inside a bar)");
    for (const change of changes)
      lines.push(`tempo: ${change.bar} ${change.beat} ${formatTempo(change.bpm, change.endBpm)}`);
  }
  if (track.repeats?.length || track.endings?.length) {
    lines.push("", "# repeat: first-last bar (add x2 for more passes), ending: bars passes");
    for (const repeat of track.repeats ?? [])
      lines.push(
        `repeat: ${repeat.from}-${repeat.to}${repeat.times && repeat.times !== 1 ? ` x${repeat.times}` : ""}`,
      );
    for (const ending of track.endings ?? [])
      lines.push(`ending: ${formatRange(ending.from, ending.to)} ${ending.passes.join(",")}`);
  }
  if (track.marks?.length || track.jumps?.length) {
    lines.push("", "# segno, coda, tocoda and fine marks, and D.C. / D.S. jumps");
    for (const mark of track.marks ?? []) lines.push(`${mark.kind}: ${mark.bar}`);
    for (const jump of track.jumps ?? [])
      lines.push(
        `${jump.to === "start" ? "dc" : "ds"}${jump.until ? ` al ${jump.until}` : ""}: ${jump.bar}`,
      );
  }
  if (track.fermatas?.length) {
    lines.push("", "# fermata and caesura: bar beat extra-seconds");
    for (const fermata of track.fermatas)
      lines.push(
        `${fermata.caesura ? "caesura" : "fermata"}: ${fermata.bar} ${fermata.beat} ${formatNumber(fermata.seconds)}`,
      );
  }
  return lines.join("\n");
}

const number = "(\\d+(?:\\.\\d+)?)";
const rowPattern = new RegExp(
  `^(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)\\s+${number}(?:\\s*->\\s*${number})?((?:\\s+[a-z]+\\s*:\\s*\\S+)*)$`,
  "i",
);
const fermataPattern = new RegExp(
  `^(fermata|caesura)\\s*:\\s*(\\d+)\\s+(\\d+|end)(?:\\s+${number})?$`,
  "i",
);
const tempoChangePattern = new RegExp(
  `^tempo\\s*:\\s*(\\d+)\\s+(\\d+)\\s+${number}(?:\\s*->\\s*${number})?$`,
  "i",
);
const wordPattern = new RegExp(
  `^(molto\\s+)?(rit|rall|accel)[a-z]*\\.?\\s*:\\s*(\\d+)(?:\\s*-\\s*(\\d+))?(?:\\s+to\\s+${number}\\s*(%)?)?$`,
  "i",
);
const aTempoPattern = /^a\s+tempo\s*:\s*(\d+)$/i;
const repeatPattern = /^repeat\s*:\s*(\d+)(?:\s*-\s*(\d+))?(?:\s+x\s*(\d+))?$/i;
const endingPattern = /^ending\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s+(\d+(?:\s*,\s*\d+)*)$/i;
const markPattern = /^(segno|coda|to\s*coda|tocoda|fine)\s*:\s*(\d+)$/i;
const jumpPattern = /^d\.?\s*([cs])\.?(?:\s+al\s+(fine|coda))?\s*:\s*(\d+)$/i;
const headerPattern = /^(title|count-in|bars)\s*:\s*(.*)$/i;

function parseOptions(text: string): Partial<Section> | string {
  const options: Partial<Section> = {};
  for (const [, key, value] of text.matchAll(/([a-z]+)\s*:\s*(\S+)/gi)) {
    const name = key.toLowerCase();
    if (name === "group") options.group = value.split("+").map(Number);
    else if (name === "sub") options.sub = Number(value);
    else if (name === "swing") options.swing = Number(value.replace("%", ""));
    else if (name === "accent") options.accent = value.split(",").map(Number) as Level[];
    else return `unknown option "${name}". Use group, sub, swing or accent.`;
  }
  return options;
}

export function parseTrackText(text: string): { track: ClickTrack } | { error: string } {
  const track: ClickTrack = { title: "", countIn: 1, bars: 0, sections: [] };
  const changes: Section[] = [];
  const words: TempoWord[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = `Line ${index + 1}`;
    const fermata = fermataPattern.exec(line);
    if (fermata) {
      const caesura = fermata[1].toLowerCase() === "caesura";
      (track.fermatas ??= []).push({
        bar: Number(fermata[2]),
        // The last beat of the bar is resolved once all sections are known.
        beat: fermata[3].toLowerCase() === "end" ? 0 : Number(fermata[3]),
        seconds:
          fermata[4] === undefined
            ? caesura
              ? DEFAULT_CAESURA
              : DEFAULT_HOLD
            : Number(fermata[4]),
        ...(caesura ? { caesura } : {}),
      });
      continue;
    }
    const header = headerPattern.exec(line);
    if (header) {
      const key = header[1].toLowerCase();
      if (key === "title") track.title = header[2].trim();
      else {
        const value = Number(header[2]);
        if (!Number.isInteger(value)) return { error: `${at}: expected a whole number.` };
        if (key === "bars") track.bars = value;
        else track.countIn = value;
      }
      continue;
    }
    const change = tempoChangePattern.exec(line);
    if (change) {
      changes.push({
        bar: Number(change[1]),
        beat: Number(change[2]),
        beats: 0,
        unit: 0,
        bpm: Number(change[3]),
        ...(change[4] === undefined ? {} : { endBpm: Number(change[4]) }),
      });
      continue;
    }
    const word = wordPattern.exec(line);
    if (word) {
      words.push({
        kind: word[2].toLowerCase() === "accel" ? "accel" : "rit",
        from: Number(word[3]),
        ...(word[4] === undefined ? {} : { to: Number(word[4]) }),
        ...(word[5] === undefined ? {} : { target: Number(word[5]), percent: word[6] === "%" }),
        ...(word[1] ? { molto: true } : {}),
      });
      continue;
    }
    const aTempo = aTempoPattern.exec(line);
    if (aTempo) {
      words.push({ kind: "atempo", from: Number(aTempo[1]) });
      continue;
    }
    const repeat = repeatPattern.exec(line);
    if (repeat) {
      const first = Number(repeat[1]);
      const last = repeat[2] === undefined ? first : Number(repeat[2]);
      const times = repeat[3] === undefined ? 1 : Number(repeat[3]);
      // "36-24" reads as "from bar 36 back to bar 24".
      (track.repeats ??= []).push({
        from: Math.min(first, last),
        to: Math.max(first, last),
        ...(times === 1 ? {} : { times }),
      });
      continue;
    }
    const ending = endingPattern.exec(line);
    if (ending) {
      const first = Number(ending[1]);
      (track.endings ??= []).push({
        from: first,
        to: ending[2] === undefined ? first : Number(ending[2]),
        passes: ending[3].split(",").map(Number),
      });
      continue;
    }
    const mark = markPattern.exec(line);
    if (mark) {
      const kind = mark[1].toLowerCase().replace(/\s/g, "") as MarkKind;
      (track.marks ??= []).push({ bar: Number(mark[2]), kind });
      continue;
    }
    const jump = jumpPattern.exec(line);
    if (jump) {
      (track.jumps ??= []).push({
        bar: Number(jump[3]),
        to: jump[1].toLowerCase() === "c" ? "start" : "segno",
        ...(jump[2] ? { until: jump[2].toLowerCase() as "fine" | "coda" } : {}),
      });
      continue;
    }
    const row = rowPattern.exec(line);
    if (!row) return { error: `${at}: use "bar beats/unit bpm", for example "1 4/4 96".` };
    const options = parseOptions(row[6] ?? "");
    if (typeof options === "string") return { error: `${at}: ${options}` };
    track.sections.push({
      bar: Number(row[1]),
      beats: Number(row[2]),
      unit: Number(row[3]),
      bpm: Number(row[4]),
      ...(row[5] === undefined ? {} : { endBpm: Number(row[5]) }),
      ...options,
    });
  }
  for (const change of changes) {
    const base = baseBefore(track.sections, change.bar);
    if (base) {
      change.beats = base.beats;
      change.unit = base.unit;
    }
    const position = track.sections.findIndex(
      (item) =>
        item.bar > change.bar || (item.bar === change.bar && (item.beat ?? 1) > change.beat!),
    );
    track.sections.splice(position < 0 ? track.sections.length : position, 0, change);
  }
  for (const fermata of track.fermatas ?? []) {
    const base = fermata.beat === 0 ? baseBefore(track.sections, fermata.bar) : undefined;
    if (base) fermata.beat = pulseCount(base);
  }
  const problem = validateTrack(track);
  if (problem) return { error: problem };
  if (words.length) {
    const failure = applyTempoWords(track, words);
    if (failure) return { error: failure };
    const again = validateTrack(track);
    if (again) return { error: again };
  }
  return { track };
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
bars: 40

# Steady 4/4 at 96 quarter notes per minute
1  4/4  96
# Waltz time
5  3/4  120
# Compound meter: two dotted-quarter pulses, each split into three soft eighth clicks
9  6/8  100 group:3+3 sub:3
# Gradual speed-up: bars 13-16 ramp from 100 to 140
13  4/4  100->140
# Odd meter with grouped pulses (2+2+3) and a medium accent on the second group
17  7/8  140 group:2+2+3 accent:3,1,2
# Swung eighths
21  4/4  120 sub:2 swing:67
# Plain 4/4 again
25  4/4  132

# Tempo change in the middle of a bar: from beat 3 of bar 23
tempo: 23 3 126

# Tempo words: accelerate over bars 25-27, slow down over bars 29-31, then resume
accel: 25-27 to 110%
rit: 29-31 to 60%
a tempo: 33

# Repeat bars 1-3 with a first ending (bar 3) and a second ending (bar 4)
repeat: 1-3
ending: 3 1
ending: 4 2

# Navigation: D.S. al coda jumps from bar 36 to the segno, plays up to "tocoda" and goes to the coda
segno: 5
tocoda: 8
coda: 37
ds al coda: 36

# Fermata: hold a beat for extra seconds. Caesura: a short break. "end" is the last beat of the bar
fermata: 8 3 2
caesura: 12 end
fermata: 40 4 3
`;
