export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const MIN_BEATS_PER_BAR = 1;
export const MAX_BEATS_PER_BAR = 16;
export const BEAT_UNITS = [1, 2, 4, 8, 16] as const;

export function clampBpm(value: number) {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
}

export function clampBeatsPerBar(value: number) {
  return Math.min(MAX_BEATS_PER_BAR, Math.max(MIN_BEATS_PER_BAR, Math.round(value)));
}

export function subdivisionIntervalSeconds(bpm: number, beatUnit: number, subdivisions: number) {
  return ((60 / bpm) * 4) / beatUnit / subdivisions;
}

export function calculateTapTempo(tapTimes: readonly number[]) {
  if (tapTimes.length < 2) return null;

  const intervals = tapTimes
    .slice(1)
    .map((time, index) => time - tapTimes[index])
    .filter((interval) => Number.isFinite(interval) && interval > 0);
  if (!intervals.length) return null;

  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  return clampBpm(60_000 / averageInterval);
}
