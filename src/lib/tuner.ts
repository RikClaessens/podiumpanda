export const instruments = [
  { id: "concert", label: "Concert pitch (C)", semitones: 0 },
  { id: "bb", label: "B♭ trumpet / clarinet", semitones: 2 },
  { id: "eb-alto", label: "E♭ alto saxophone", semitones: 9 },
  { id: "bb-tenor", label: "B♭ tenor saxophone / bass clarinet", semitones: 14 },
  { id: "eb-baritone", label: "E♭ baritone saxophone", semitones: 21 },
  { id: "f-horn", label: "F horn / English horn", semitones: 7 },
  { id: "eb-clarinet", label: "E♭ clarinet", semitones: -3 },
] as const;

export type InstrumentId = (typeof instruments)[number]["id"];

export function isInstrumentId(value: string | null): value is InstrumentId {
  return instruments.some((instrument) => instrument.id === value);
}

export const DEFAULT_REFERENCE_HZ = 440;
export const MIN_REFERENCE_HZ = 400;
export const MAX_REFERENCE_HZ = 480;

export function parseReferenceHz(value: string | null) {
  const reference = Number(value);
  return Number.isInteger(reference) &&
    reference >= MIN_REFERENCE_HZ &&
    reference <= MAX_REFERENCE_HZ
    ? reference
    : DEFAULT_REFERENCE_HZ;
}

const notes = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function pitchReading(
  frequency: number,
  instrument: InstrumentId,
  referenceHz = DEFAULT_REFERENCE_HZ,
) {
  const midi = 69 + 12 * Math.log2(frequency / referenceHz);
  const nearest = Math.round(midi);
  const offset = instruments.find((item) => item.id === instrument)!.semitones;
  const written = nearest + offset;
  return {
    note: notes[((written % 12) + 12) % 12],
    octave: Math.floor(written / 12) - 1,
    cents: Math.round((midi - nearest) * 100),
    frequency,
  };
}

// YIN's normalized difference finds the first reliable period, avoiding octave errors.
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  if (Math.sqrt(energy / samples.length) < 0.01) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / 4200));
  const maxLag = Math.min(Math.floor(sampleRate / 27), Math.floor(samples.length / 2) - 1);
  const windowSize = samples.length - maxLag;
  const difference = new Float32Array(maxLag + 1);
  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      const delta = samples[i] - samples[i + lag];
      sum += delta * delta;
    }
    runningSum += sum;
    difference[lag] = runningSum === 0 ? 1 : (sum * lag) / runningSum;
  }
  for (let lag = minLag; lag < maxLag; lag++) {
    if (difference[lag] < 0.15) {
      while (lag + 1 <= maxLag && difference[lag + 1] < difference[lag]) lag++;
      const before = difference[lag - 1];
      const center = difference[lag];
      const after = difference[Math.min(lag + 1, maxLag)];
      const denominator = 2 * (2 * center - after - before);
      const refined = denominator === 0 ? lag : lag + (after - before) / denominator;
      return sampleRate / refined;
    }
  }
  return null;
}
