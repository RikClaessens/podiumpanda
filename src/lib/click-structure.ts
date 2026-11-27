import { MAX_BARS } from "./click-limits";

// A measure as written in a score, with the navigation marks needed to work out the played order.
export type ScoreMeasure = {
  beats: number;
  unit: number;
  bpm: number | null;
  repeatStart?: boolean;
  repeatEnd?: number;
  volta?: number[] | null;
  marks: string[];
  jump?: { to: string; until?: string; continueAt?: string };
  afterJump?: { goto?: string };
};

export type PlayedMeasure = { index: number; pass: number };

const GUARD = MAX_BARS * 4;

// Expands repeats, voltas and jumps (D.C./D.S./coda) into the order the measures are played.
export function unrollDetailed(measures: readonly ScoreMeasure[]): PlayedMeasure[] {
  const order: PlayedMeasure[] = [];
  const indexOfMark = (label: string) => measures.findIndex((item) => item.marks.includes(label));
  const repeatsDone = new Map<number, number>();
  const jumpsDone = new Set<number>();
  let jumped: { until?: string; continueAt?: string } | null = null;
  let index = 0;
  let pass = 1;
  let repeatStart = 0;
  let arrivedByRepeat = false;
  while (index < measures.length && order.length < GUARD) {
    const measure = measures[index];
    if (measure.repeatStart && !arrivedByRepeat) {
      repeatStart = index;
      pass = 1;
    }
    arrivedByRepeat = false;
    if (measure.volta && !measure.volta.includes(pass)) {
      index++;
      continue;
    }
    order.push({ index, pass });
    if (jumped) {
      const stop =
        measure.afterJump ??
        (jumped.until && measure.marks.includes(jumped.until)
          ? { goto: jumped.continueAt }
          : undefined);
      if (stop) {
        if (!stop.goto) break;
        const target = indexOfMark(stop.goto);
        if (target < 0) break;
        jumped = null;
        index = target;
        continue;
      }
    } else if (measure.jump && !jumpsDone.has(index)) {
      jumpsDone.add(index);
      const target = measure.jump.to === "start" ? 0 : indexOfMark(measure.jump.to);
      if (target >= 0) {
        jumped = { until: measure.jump.until, continueAt: measure.jump.continueAt };
        index = target;
        continue;
      }
    }
    if (measure.repeatEnd && !jumped) {
      const done = repeatsDone.get(index) ?? 0;
      if (done < measure.repeatEnd - 1) {
        repeatsDone.set(index, done + 1);
        pass = done + 2;
        index = repeatStart;
        arrivedByRepeat = true;
        continue;
      }
      repeatsDone.set(index, 0);
      repeatStart = index + 1;
      pass = 1;
    }
    index++;
  }
  return order;
}

export const unroll = (measures: readonly ScoreMeasure[]) =>
  unrollDetailed(measures).map((item) => item.index);
