import { instruments, type InstrumentId } from "./tuner";

export const pitchClasses = [
  "C",
  "C♯/D♭",
  "D",
  "D♯/E♭",
  "E",
  "F",
  "F♯/G♭",
  "G",
  "G♯/A♭",
  "A",
  "A♯/B♭",
  "B",
] as const;

export function transposeNote(written: number, from: InstrumentId, to: InstrumentId) {
  const fromOffset = instruments.find((instrument) => instrument.id === from)!.semitones;
  const toOffset = instruments.find((instrument) => instrument.id === to)!.semitones;
  return transposeByOffsets(written, fromOffset, toOffset);
}

export function transposeByOffsets(written: number, fromOffset: number, toOffset: number) {
  const concert = written - fromOffset;
  return { concert, result: concert + toOffset };
}

export function formatNote(note: number) {
  const pitch = pitchClasses[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return pitch
    .split("/")
    .map((name) => `${name}${octave}`)
    .join(" / ");
}
