import { MAX_BARS, sectionsFromBars, UNITS, type ClickTrack } from "./click-track";
import { child, childText, childrenNamed, descendants, parseXml } from "./xml";
import { listZip, readZipEntry, readZipText } from "./zip";

const round2 = (value: number) => Math.round(value * 100) / 100;
const decoder = new TextDecoder();

export class ImportError extends Error {}

type Bar = { beats: number; unit: number; bpm: number };

function toTrack(title: string, bars: Bar[]): ClickTrack {
  if (!bars.length) throw new ImportError("No bars were found in this file.");
  if (bars.length > MAX_BARS) throw new ImportError(`This piece has more than ${MAX_BARS} bars.`);
  return {
    title,
    countIn: 1,
    bars: bars.length,
    sections: sectionsFromBars(bars.map((bar) => ({ ...bar, bpm: round2(bar.bpm) }))),
  };
}

// ---------------------------------------------------------------------------------------------
// MIDI

export function importMidi(bytes: Uint8Array, fallbackTitle = ""): ClickTrack {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14 || view.getUint32(0) !== 0x4d546864)
    throw new ImportError("This is not a MIDI file.");
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new ImportError("MIDI files with SMPTE timing are not supported.");
  const tempos: { tick: number; microseconds: number }[] = [];
  const signatures: { tick: number; beats: number; unit: number }[] = [];
  let title = "";
  let lastTick = 0;
  let position = 8 + view.getUint32(4);
  for (let index = 0; index < trackCount && position + 8 <= bytes.length; index++) {
    const length = view.getUint32(position + 4);
    const end = Math.min(bytes.length, position + 8 + length);
    let cursor = position + 8;
    let tick = 0;
    let status = 0;
    const readVariable = () => {
      let value = 0;
      for (let count = 0; count < 4 && cursor < end; count++) {
        const byte = bytes[cursor++];
        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) break;
      }
      return value;
    };
    while (cursor < end) {
      tick += readVariable();
      let first = bytes[cursor];
      if (first === undefined) break;
      if (first & 0x80) {
        status = first;
        cursor++;
      } else first = status;
      if (status === 0xff) {
        const type = bytes[cursor++];
        const size = readVariable();
        if (type === 0x51 && size === 3)
          tempos.push({
            tick,
            microseconds: (bytes[cursor] << 16) | (bytes[cursor + 1] << 8) | bytes[cursor + 2],
          });
        else if (type === 0x58 && size >= 2)
          signatures.push({ tick, beats: bytes[cursor], unit: 2 ** bytes[cursor + 1] });
        else if (type === 0x03 && !title && index <= 1)
          title = decoder.decode(bytes.subarray(cursor, cursor + size)).trim();
        cursor += size;
      } else if (status === 0xf0 || status === 0xf7) cursor += readVariable();
      else cursor += (status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0 ? 1 : 2;
      lastTick = Math.max(lastTick, tick);
    }
    position += 8 + length;
  }
  tempos.sort((a, b) => a.tick - b.tick);
  signatures.sort((a, b) => a.tick - b.tick);
  const bars: Bar[] = [];
  let tick = 0;
  do {
    const signature = [...signatures].reverse().find((item) => item.tick <= tick) ?? {
      beats: 4,
      unit: 4,
    };
    const tempo = [...tempos].reverse().find((item) => item.tick <= tick)?.microseconds ?? 500000;
    bars.push({ beats: signature.beats, unit: signature.unit, bpm: 60_000_000 / tempo });
    tick += Math.round((signature.beats * division * 4) / signature.unit);
  } while (tick < lastTick && bars.length <= MAX_BARS);
  return toTrack(title || fallbackTitle, bars);
}

// ---------------------------------------------------------------------------------------------
// Score structure shared by the MusicXML and MuseScore readers

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

const GUARD = MAX_BARS * 4;

// Expands repeats, voltas and jumps (D.C./D.S./coda) into the order the measures are played.
export function unroll(measures: readonly ScoreMeasure[]): number[] {
  const order: number[] = [];
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
    order.push(index);
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

export function barsFromMeasures(measures: readonly ScoreMeasure[]): Bar[] {
  let bpm = 120;
  const tempoAt = measures.map((measure) => (bpm = measure.bpm ?? bpm));
  return unroll(measures).map((index) => ({
    beats: measures[index].beats,
    unit: measures[index].unit,
    bpm: tempoAt[index],
  }));
}

// Express a bar length in quarter notes as beats of the given unit, using a finer unit if needed.
export function signatureFromQuarters(quarters: number, unit: number) {
  for (const candidate of UNITS.filter((item) => item >= unit)) {
    const beats = (quarters * candidate) / 4;
    if (Math.abs(beats - Math.round(beats)) < 0.01 && Math.round(beats) >= 1)
      return { beats: Math.round(beats), unit: candidate };
  }
  return { beats: Math.max(1, Math.round((quarters * unit) / 4)), unit };
}

// ---------------------------------------------------------------------------------------------
// MusicXML

const noteQuarters: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  "16th": 0.25,
  "32nd": 0.125,
  breve: 8,
};

function parseVolta(value: string | undefined) {
  const numbers = (value ?? "")
    .split(/[,\s]+/)
    .map(Number)
    .filter(Number.isInteger);
  return numbers.length ? numbers : [1];
}

export function importMusicXml(source: string, fallbackTitle = ""): ClickTrack {
  const root = parseXml(source);
  if (root.name !== "score-partwise")
    throw new ImportError("Only partwise MusicXML scores are supported.");
  const part = child(root, "part");
  if (!part) throw new ImportError("No music was found in this MusicXML file.");
  const title =
    childText(child(root, "work") ?? root, "work-title") ?? childText(root, "movement-title") ?? "";
  let beats = 4;
  let unit = 4;
  let divisions = 1;
  let volta: number[] | null = null;
  const measures: ScoreMeasure[] = [];
  for (const node of childrenNamed(part, "measure")) {
    for (const attributes of childrenNamed(node, "attributes")) {
      divisions = Number(childText(attributes, "divisions")) || divisions;
      const time = child(attributes, "time");
      if (time) {
        const sum = (childText(time, "beats") ?? "")
          .split("+")
          .reduce((total, value) => total + (Number(value) || 0), 0);
        if (sum > 0) beats = sum;
        unit = Number(childText(time, "beat-type")) || unit;
      }
    }
    let bpm: number | null = null;
    const measure: ScoreMeasure = { beats, unit, bpm: null, marks: [] };
    for (const direction of [...childrenNamed(node, "direction"), node]) {
      for (const sound of childrenNamed(direction, "sound")) {
        if (bpm === null && Number(sound.attrs.tempo) > 0) bpm = Number(sound.attrs.tempo);
        if (sound.attrs.segno) measure.marks.push(`segno:${sound.attrs.segno}`);
        if (sound.attrs.coda) measure.marks.push(`coda:${sound.attrs.coda}`);
        if (sound.attrs.fine) measure.afterJump = {};
        if (sound.attrs.tocoda) measure.afterJump = { goto: `coda:${sound.attrs.tocoda}` };
        if (sound.attrs.dacapo === "yes") measure.jump = { to: "start" };
        if (sound.attrs.dalsegno) measure.jump = { to: `segno:${sound.attrs.dalsegno}` };
      }
      const metronome = descendants(direction, "metronome")[0];
      if (bpm === null && metronome) {
        const perMinute = Number.parseFloat(childText(metronome, "per-minute") ?? "");
        const base = noteQuarters[childText(metronome, "beat-unit") ?? ""];
        if (perMinute > 0 && base) {
          const dots = childrenNamed(metronome, "beat-unit-dot").length;
          bpm = perMinute * base * (2 - 0.5 ** dots);
        }
      }
    }
    measure.bpm = bpm;
    let cursor = 0;
    let furthest = 0;
    for (const item of node.children) {
      const duration = Number(childText(item, "duration")) || 0;
      if (item.name === "note" && !child(item, "chord") && !child(item, "grace"))
        cursor += duration;
      else if (item.name === "forward") cursor += duration;
      else if (item.name === "backup") cursor -= duration;
      furthest = Math.max(furthest, cursor);
    }
    if (node.attrs.implicit === "yes" && furthest > 0)
      Object.assign(measure, signatureFromQuarters(furthest / divisions, unit));
    const stops: boolean[] = [];
    for (const barline of childrenNamed(node, "barline")) {
      const repeat = child(barline, "repeat");
      if (repeat?.attrs.direction === "forward") measure.repeatStart = true;
      if (repeat?.attrs.direction === "backward")
        measure.repeatEnd = Number(repeat.attrs.times) || 2;
      const ending = child(barline, "ending");
      if (ending?.attrs.type === "start") volta = parseVolta(ending.attrs.number);
      else if (ending) stops.push(true);
    }
    measure.volta = volta;
    if (stops.length) volta = null;
    measures.push(measure);
  }
  return toTrack(title || fallbackTitle, barsFromMeasures(measures));
}

// ---------------------------------------------------------------------------------------------
// MuseScore (.mscx)

export function importMuseScore(source: string, fallbackTitle = ""): ClickTrack {
  const root = parseXml(source);
  const score = root.name === "Score" ? root : child(root, "Score");
  if (!score) throw new ImportError("No score was found in this MuseScore file.");
  const staff = childrenNamed(score, "Staff").find((item) => child(item, "Measure"));
  if (!staff) throw new ImportError("No music was found in this MuseScore file.");
  const title =
    descendants(score, "metaTag")
      .find((tag) => tag.attrs.name === "workTitle")
      ?.text.trim() ?? "";
  let beats = 4;
  let unit = 4;
  const measures: ScoreMeasure[] = [];
  let voltaLeft = 0;
  let volta: number[] | null = null;
  for (const node of childrenNamed(staff, "Measure")) {
    const timeSig = descendants(node, "TimeSig")[0];
    if (timeSig) {
      beats = Number(childText(timeSig, "sigN")) || beats;
      unit = Number(childText(timeSig, "sigD")) || unit;
    }
    const measure: ScoreMeasure = { beats, unit, bpm: null, marks: [] };
    const length = /^(\d+)\/(\d+)$/.exec(node.attrs.len ?? "");
    if (length && Number(length[1]) * unit !== beats * Number(length[2]))
      Object.assign(
        measure,
        signatureFromQuarters((Number(length[1]) * 4) / Number(length[2]), unit),
      );
    const tempo = Number(childText(descendants(node, "Tempo")[0] ?? node, "tempo"));
    if (tempo > 0) measure.bpm = tempo * 60;
    if (descendants(node, "startRepeat").length) measure.repeatStart = true;
    const endRepeat = descendants(node, "endRepeat")[0];
    if (endRepeat) measure.repeatEnd = Number(endRepeat.text) || 2;
    for (const spanner of descendants(node, "Spanner")) {
      const voltaNode = child(spanner, "Volta");
      if (spanner.attrs.type !== "Volta" || !voltaNode) continue;
      volta = parseVolta(childText(voltaNode, "endings"));
      voltaLeft =
        Number(childText(descendants(spanner, "location")[0] ?? spanner, "measures")) || 1;
    }
    if (voltaLeft > 0) {
      measure.volta = volta;
      voltaLeft--;
    }
    for (const marker of descendants(node, "Marker")) {
      const label = (
        childText(marker, "label") ??
        childText(marker, "subtype") ??
        ""
      ).toLowerCase();
      if (label) measure.marks.push(label);
    }
    const jump = descendants(node, "Jump")[0];
    if (jump)
      measure.jump = {
        to: (childText(jump, "jumpTo") ?? "start").toLowerCase(),
        until: childText(jump, "playUntil")?.toLowerCase(),
        continueAt: childText(jump, "continueAt")?.toLowerCase(),
      };
    measures.push(measure);
  }
  return toTrack(title || fallbackTitle, barsFromMeasures(measures));
}

// ---------------------------------------------------------------------------------------------
// Files

export async function importScoreFile(name: string, bytes: Uint8Array): Promise<ClickTrack> {
  const lower = name.toLowerCase();
  const fallbackTitle = name.replace(/\.[^.]+$/, "");
  try {
    if (lower.endsWith(".mid") || lower.endsWith(".midi")) return importMidi(bytes, fallbackTitle);
    if (lower.endsWith(".mscx")) return importMuseScore(decoder.decode(bytes), fallbackTitle);
    if (lower.endsWith(".musicxml") || lower.endsWith(".xml"))
      return importMusicXml(decoder.decode(bytes), fallbackTitle);
    if (lower.endsWith(".mscz")) {
      const entry = listZip(bytes).find((item) => item.name.toLowerCase().endsWith(".mscx"));
      if (!entry) throw new ImportError("No score was found inside this MuseScore file.");
      return importMuseScore(decoder.decode(await readZipEntry(bytes, entry)), fallbackTitle);
    }
    if (lower.endsWith(".mxl")) {
      const container = parseXml(await readZipText(bytes, "META-INF/container.xml"));
      const path = descendants(container, "rootfile")[0]?.attrs["full-path"];
      if (!path) throw new ImportError("No score was found inside this MusicXML file.");
      return importMusicXml(await readZipText(bytes, path), fallbackTitle);
    }
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError("This file could not be read.");
  }
  throw new ImportError("Unsupported file type. Use MIDI, MusicXML or MuseScore files.");
}
