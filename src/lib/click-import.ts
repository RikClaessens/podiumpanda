import {
  applyTempoWords,
  DEFAULT_CAESURA,
  DEFAULT_HOLD,
  MAX_BARS,
  MAX_HOLD,
  pulseCount,
  pulseGroups,
  sectionsFromBars,
  UNITS,
  unitOffsets,
  type BarInput,
  type ClickTrack,
  type Ending,
  type Fermata,
  type Jump,
  type Marker,
  type MarkKind,
  type Repeat,
  type TempoWord,
} from "./click-track";
import { unroll, type ScoreMeasure } from "./click-structure";
import { child, childText, childrenNamed, descendants, parseXml, type XmlNode } from "./xml";
import { listZip, readZipEntry, readZipText } from "./zip";

export { unroll, type ScoreMeasure };

const round2 = (value: number) => Math.round(value * 100) / 100;
const decoder = new TextDecoder();

export class ImportError extends Error {}

// A tempo word, a fermata or a tempo step found at a position (in quarter notes) inside a measure.
type Events = {
  tempo: { at: number; bpm: number }[];
  fermatas: { at: number; caesura?: boolean; end?: boolean }[];
  words: { at: number; kind: TempoWord["kind"]; molto?: boolean }[];
};

const emptyEvents = (): Events => ({ tempo: [], fermatas: [], words: [] });

type Measure = ScoreMeasure & {
  group?: number[];
  swing?: number;
  changes?: { beat: number; bpm: number }[];
  fermatas?: { beat: number; seconds?: number; caesura?: boolean }[];
  words?: { kind: TempoWord["kind"]; molto?: boolean }[];
};

const tempoWordKind = (text: string): { kind: TempoWord["kind"]; molto?: boolean } | null => {
  const lower = text.toLowerCase();
  if (/\ba\s*tempo\b|\btempo\s*primo\b/.test(lower)) return { kind: "atempo" };
  if (/\b(rit|rall|ritard|allarg)/.test(lower))
    return { kind: "rit", ...(/molto/.test(lower) ? { molto: true } : {}) };
  if (/\baccel/.test(lower))
    return { kind: "accel", ...(/molto/.test(lower) ? { molto: true } : {}) };
  return null;
};

// Places the events found in a measure on its pulses. Returns a tempo that was written at the very
// end of the measure, which belongs to the next measure.
function placeEvents(measure: Measure, events: Events): number | null {
  const offsets = unitOffsets(pulseGroups(measure));
  const unitsOf = (quarters: number) => (quarters * measure.unit) / 4;
  const containing = (units: number) => {
    let found = 0;
    for (const [pulse, offset] of offsets.entries()) if (offset <= units + 0.01) found = pulse;
    return found;
  };
  let carried: number | null = null;
  for (const event of events.tempo) {
    const units = unitsOf(event.at);
    if (units >= measure.beats - 0.01) carried = event.bpm;
    else if (units < 0.01) measure.bpm ??= event.bpm;
    else {
      let nearest = 0;
      for (const [pulse, offset] of offsets.entries())
        if (Math.abs(offset - units) < Math.abs(offsets[nearest] - units)) nearest = pulse;
      if (nearest === 0) measure.bpm ??= event.bpm;
      else
        measure.changes = [
          ...(measure.changes ?? []).filter((change) => change.beat !== nearest + 1),
          { beat: nearest + 1, bpm: event.bpm },
        ];
    }
  }
  for (const event of events.fermatas) {
    const beat = event.end
      ? pulseCount(measure)
      : containing(Math.max(0, unitsOf(event.at) - (event.caesura ? 0.02 : 0))) + 1;
    if (!measure.fermatas?.some((item) => item.beat === beat))
      (measure.fermatas ??= []).push({ beat, ...(event.caesura ? { caesura: true } : {}) });
  }
  for (const word of events.words)
    (measure.words ??= []).push({ kind: word.kind, ...(word.molto ? { molto: true } : {}) });
  return carried;
}

function structureOf(measures: readonly Measure[]) {
  const repeats: Repeat[] = [];
  const endings: Ending[] = [];
  const marks: Marker[] = [];
  const jumps: Jump[] = [];
  let start = 0;
  for (const [index, measure] of measures.entries()) {
    if (measure.repeatStart) start = index;
    if (measure.repeatEnd) {
      const times = measure.repeatEnd - 1;
      repeats.push({ from: start + 1, to: index + 1, ...(times === 1 ? {} : { times }) });
      start = index + 1;
    }
    const previous = endings[endings.length - 1];
    if (measure.volta) {
      if (previous && previous.to === index && previous.passes.join() === measure.volta.join())
        previous.to = index + 1;
      else endings.push({ from: index + 1, to: index + 1, passes: [...measure.volta] });
    }
  }
  const find = (label: string) => measures.findIndex((item) => item.marks.includes(label));
  // Only one segno, coda, "to coda" and fine mark are supported, so jumps that need others are skipped.
  const place = (kind: MarkKind, bar: number) => {
    const existing = marks.find((mark) => mark.kind === kind);
    if (existing) return existing.bar === bar;
    marks.push({ kind, bar });
    return true;
  };
  for (const [index, measure] of measures.entries()) {
    const jump = measure.jump;
    if (!jump) continue;
    const entry: Jump = { bar: index + 1, to: "start" };
    if (jump.to !== "start") {
      const target = find(jump.to);
      if (target < 0 || !place("segno", target + 1)) continue;
      entry.to = "segno";
    }
    if (jump.until) {
      const stop = find(jump.until);
      if (jump.continueAt) {
        const coda = find(jump.continueAt);
        if (stop >= 0 && coda >= 0 && place("tocoda", stop + 1) && place("coda", coda + 1))
          entry.until = "coda";
      } else if (stop >= 0 && place("fine", stop + 1)) entry.until = "fine";
    } else {
      const stop = measures.findIndex((item) => item.afterJump);
      const after = measures[stop]?.afterJump;
      if (after?.goto) {
        const coda = find(after.goto);
        if (coda >= 0 && place("tocoda", stop + 1) && place("coda", coda + 1)) entry.until = "coda";
      } else if (after && place("fine", stop + 1)) entry.until = "fine";
    }
    jumps.push(entry);
  }
  return { repeats, endings, marks, jumps };
}

function wordsOf(measures: readonly Measure[]): TempoWord[] {
  const marked = (index: number) =>
    measures[index].bpm !== null ||
    !!measures[index].changes?.length ||
    !!measures[index].words?.some((word) => word.kind === "atempo");
  const words: TempoWord[] = [];
  for (const [index, measure] of measures.entries())
    for (const word of measure.words ?? []) {
      if (word.kind === "atempo") {
        words.push({ kind: "atempo", from: index + 1 });
        continue;
      }
      // A ritardando or accelerando runs for a few bars, until the next explicit tempo.
      let end = index;
      while (end + 1 < measures.length && end - index < 3 && !marked(end + 1)) end++;
      words.push({
        kind: word.kind,
        from: index + 1,
        to: end + 1,
        ...(word.molto ? { molto: true } : {}),
      });
    }
  return words;
}

function toTrack(title: string, measures: Measure[]): ClickTrack {
  if (!measures.length) throw new ImportError("No bars were found in this file.");
  if (measures.length > MAX_BARS)
    throw new ImportError(`This piece has more than ${MAX_BARS} bars.`);
  let bpm = 120;
  const bars = measures.map<BarInput>((measure) => {
    bpm = measure.bpm ?? bpm;
    const start = bpm;
    const changes = (measure.changes ?? [])
      .filter((change) => change.beat >= 2 && change.beat <= pulseCount(measure))
      .sort((a, b) => a.beat - b.beat)
      .filter((change) => Math.abs(change.bpm - start) > 0.005)
      .map((change) => ({ beat: change.beat, bpm: round2(change.bpm) }));
    if (measure.changes?.length) bpm = measure.changes[measure.changes.length - 1].bpm;
    return {
      beats: measure.beats,
      unit: measure.unit,
      bpm: round2(start),
      ...(measure.group ? { group: measure.group } : {}),
      ...(measure.swing ? { swing: measure.swing } : {}),
      ...(changes.length ? { changes } : {}),
    };
  });
  const track: ClickTrack = {
    title,
    countIn: 1,
    bars: bars.length,
    sections: sectionsFromBars(bars),
  };
  const { repeats, endings, marks, jumps } = structureOf(measures);
  if (repeats.length) track.repeats = repeats;
  if (endings.length) track.endings = endings;
  if (marks.length) track.marks = marks;
  if (jumps.length) track.jumps = jumps;
  const fermatas: Fermata[] = [];
  for (const [index, measure] of measures.entries())
    for (const item of measure.fermatas ?? [])
      if (item.beat >= 1 && item.beat <= pulseCount(measure))
        fermatas.push({
          bar: index + 1,
          beat: item.beat,
          seconds: item.seconds ?? (item.caesura ? DEFAULT_CAESURA : DEFAULT_HOLD),
          ...(item.caesura ? { caesura: true } : {}),
        });
  if (fermatas.length) track.fermatas = fermatas;
  const words = wordsOf(measures);
  if (words.length) applyTempoWords(track, words, { lenient: true });
  return track;
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
  type Pulse = { bar: number; unit: number; units: number; bpm: number };
  const pulses: Pulse[] = [];
  const signatureOfBar: { beats: number; unit: number }[] = [];
  let tick = 0;
  do {
    const signature = [...signatures].reverse().find((item) => item.tick <= tick) ?? {
      beats: 4,
      unit: 4,
    };
    const unitTicks = Math.round((division * 4) / signature.unit);
    for (let beat = 0; beat < signature.beats; beat++) {
      const at = tick + beat * unitTicks;
      const tempo = [...tempos].reverse().find((item) => item.tick <= at)?.microseconds ?? 500000;
      pulses.push({
        bar: signatureOfBar.length,
        unit: signature.unit,
        units: 1,
        bpm: 60_000_000 / tempo,
      });
    }
    signatureOfBar.push({ beats: signature.beats, unit: signature.unit });
    tick += unitTicks * signature.beats;
  } while (tick < lastTick && signatureOfBar.length <= MAX_BARS);
  // A single pulse that is much slower than its neighbours is a fermata that our own export (and
  // most notation programs) write as a tempo dip. Treat it as a fermata and restore the tempo.
  const seconds = (pulse: Pulse, bpm: number) => (240 * pulse.units) / (bpm * pulse.unit);
  const fermatas = new Map<number, number>();
  for (const [index, pulse] of pulses.entries()) {
    const before = pulses[index - 1];
    const after = pulses[index + 1];
    const neighbours = [before, after].filter((item) => item !== undefined);
    if (!neighbours.length) continue;
    if (
      neighbours.length === 2 &&
      Math.abs(before.bpm - after.bpm) > 0.03 * Math.max(before.bpm, after.bpm)
    )
      continue;
    const reference = before ?? after;
    const normal = seconds(pulse, reference.bpm);
    const extra = seconds(pulse, pulse.bpm) - normal;
    if (pulse.bpm * 1.6 <= reference.bpm && extra >= 0.3) fermatas.set(index, round2(extra));
  }
  const bpms = pulses.map((pulse, index) => {
    if (!fermatas.has(index)) return pulse.bpm;
    return (pulses[index - 1] ?? pulses[index + 1]).bpm;
  });
  const measures: Measure[] = [];
  let first = 0;
  for (const signature of signatureOfBar) {
    const own = bpms.slice(first, first + signature.beats);
    const measure: Measure = { ...signature, bpm: own[0], marks: [] };
    // One clean step inside the bar is a tempo change; anything else is a ramp that follows per bar.
    const change = own.findIndex((value) => Math.abs(value - own[0]) > 0.005);
    if (change > 0 && own.slice(change).every((value) => Math.abs(value - own[change]) <= 0.005))
      measure.changes = [{ beat: change + 1, bpm: own[change] }];
    const held = [...fermatas.keys()].filter((at) => at >= first && at < first + signature.beats);
    if (held.length) {
      measure.fermatas = held.map((at) => ({
        beat: at - first + 1,
        seconds: Math.min(MAX_HOLD, fermatas.get(at)!),
      }));
    }
    measures.push(measure);
    first += signature.beats;
  }
  return toTrack(title || fallbackTitle, measures);
}

// ---------------------------------------------------------------------------------------------
// Score helpers shared by the MusicXML and MuseScore readers

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

const nodeText = (node: XmlNode): string =>
  [node.text, ...node.children.map(nodeText)].join(" ").replace(/\s+/g, " ").trim();

function swingOf(sound: XmlNode): number | null | undefined {
  const swing = child(sound, "swing");
  if (!swing) return undefined;
  if (child(swing, "straight")) return null;
  const first = Number(childText(swing, "first"));
  const second = Number(childText(swing, "second"));
  if (!(first > 0 && second > 0)) return undefined;
  const percent = Math.round((first / (first + second)) * 100);
  return percent > 50 && percent <= 90 ? percent : null;
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
  let group: number[] | undefined;
  let swing: number | undefined;
  let volta: number[] | null = null;
  let carried: number | null = null;
  const measures: Measure[] = [];
  for (const node of childrenNamed(part, "measure")) {
    for (const attributes of childrenNamed(node, "attributes")) {
      divisions = Number(childText(attributes, "divisions")) || divisions;
      const time = child(attributes, "time");
      if (time) {
        // "2+2+3" groups the pulses of an additive meter.
        const parts = (childText(time, "beats") ?? "")
          .split("+")
          .map((value) => Number(value) || 0);
        const sum = parts.reduce((total, value) => total + value, 0);
        if (sum > 0) {
          beats = sum;
          group = parts.length > 1 && parts.every((value) => value > 0) ? parts : undefined;
        }
        unit = Number(childText(time, "beat-type")) || unit;
      }
    }
    const measure: Measure = { beats, unit, bpm: null, marks: [] };
    const events = emptyEvents();
    const readSound = (sound: XmlNode, at: number) => {
      if (sound.attrs.segno) measure.marks.push(`segno:${sound.attrs.segno}`);
      if (sound.attrs.coda) measure.marks.push(`coda:${sound.attrs.coda}`);
      if (sound.attrs.fine) measure.afterJump = {};
      if (sound.attrs.tocoda) measure.afterJump = { goto: `coda:${sound.attrs.tocoda}` };
      if (sound.attrs.dacapo === "yes") measure.jump = { to: "start" };
      if (sound.attrs.dalsegno) measure.jump = { to: `segno:${sound.attrs.dalsegno}` };
      const swung = swingOf(sound);
      if (swung !== undefined) swing = swung ?? undefined;
      const tempo = Number(sound.attrs.tempo);
      if (tempo > 0) events.tempo.push({ at, bpm: tempo });
      return tempo > 0;
    };
    let cursor = 0;
    let furthest = 0;
    let lastStart = 0;
    for (const item of node.children) {
      const duration = Number(childText(item, "duration")) || 0;
      if (item.name === "sound") readSound(item, cursor / divisions);
      else if (item.name === "direction") {
        const at = cursor / divisions;
        let found = false;
        for (const sound of childrenNamed(item, "sound")) found = readSound(sound, at) || found;
        const metronome = descendants(item, "metronome")[0];
        if (!found && metronome) {
          const perMinute = Number.parseFloat(childText(metronome, "per-minute") ?? "");
          const base = noteQuarters[childText(metronome, "beat-unit") ?? ""];
          if (perMinute > 0 && base) {
            const dots = childrenNamed(metronome, "beat-unit-dot").length;
            events.tempo.push({ at, bpm: perMinute * base * (2 - 0.5 ** dots) });
          }
        }
        for (const words of descendants(item, "words")) {
          const word = tempoWordKind(nodeText(words));
          if (word) events.words.push({ at, ...word });
        }
      } else if (item.name === "note") {
        const grace = !!child(item, "grace");
        const chord = !!child(item, "chord");
        const start = chord ? lastStart : cursor;
        if (!grace && !chord) {
          lastStart = cursor;
          cursor += duration;
        }
        if (!grace) {
          if (descendants(item, "fermata").length) events.fermatas.push({ at: start / divisions });
          if (descendants(item, "caesura").length)
            events.fermatas.push({ at: cursor / divisions, caesura: true });
        }
      } else if (item.name === "forward") cursor += duration;
      else if (item.name === "backup") cursor -= duration;
      furthest = Math.max(furthest, cursor);
    }
    if (node.attrs.implicit === "yes" && furthest > 0)
      Object.assign(measure, signatureFromQuarters(furthest / divisions, unit));
    if (group && group.reduce((total, value) => total + value, 0) === measure.beats)
      measure.group = group;
    if (swing) measure.swing = swing;
    const stops: boolean[] = [];
    for (const barline of childrenNamed(node, "barline")) {
      const repeat = child(barline, "repeat");
      if (repeat?.attrs.direction === "forward") measure.repeatStart = true;
      if (repeat?.attrs.direction === "backward")
        measure.repeatEnd = Number(repeat.attrs.times) || 2;
      const ending = child(barline, "ending");
      if (ending?.attrs.type === "start") volta = parseVolta(ending.attrs.number);
      else if (ending) stops.push(true);
      if (child(barline, "fermata"))
        events.fermatas.push(barline.attrs.location === "left" ? { at: 0 } : { at: 0, end: true });
    }
    measure.volta = volta;
    if (stops.length) volta = null;
    const next = placeEvents(measure, events);
    if (measure.bpm === null && carried !== null) measure.bpm = carried;
    carried = next;
    measures.push(measure);
  }
  return toTrack(title || fallbackTitle, measures);
}

// ---------------------------------------------------------------------------------------------
// MuseScore (.mscx)

const durationTypes: Record<string, number> = {
  long: 16,
  breve: 8,
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  "16th": 0.25,
  "32nd": 0.125,
  "64th": 0.0625,
  "128th": 0.03125,
};

function museScoreQuarters(node: XmlNode, measureQuarters: number, scale: number) {
  if (childText(node, "durationType") === "measure") {
    const length = /^(\d+)\/(\d+)$/.exec(childText(node, "duration") ?? "");
    return length ? (Number(length[1]) * 4) / Number(length[2]) : measureQuarters;
  }
  const dots = Number(childText(node, "dots")) || 0;
  return (durationTypes[childText(node, "durationType") ?? ""] ?? 0) * (2 - 0.5 ** dots) * scale;
}

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
  let carried: number | null = null;
  const measures: Measure[] = [];
  let voltaLeft = 0;
  let volta: number[] | null = null;
  for (const node of childrenNamed(staff, "Measure")) {
    const timeSig = descendants(node, "TimeSig")[0];
    if (timeSig) {
      beats = Number(childText(timeSig, "sigN")) || beats;
      unit = Number(childText(timeSig, "sigD")) || unit;
    }
    const measure: Measure = { beats, unit, bpm: null, marks: [] };
    const length = /^(\d+)\/(\d+)$/.exec(node.attrs.len ?? "");
    if (length && Number(length[1]) * unit !== beats * Number(length[2]))
      Object.assign(
        measure,
        signatureFromQuarters((Number(length[1]) * 4) / Number(length[2]), unit),
      );
    const events = emptyEvents();
    const measureQuarters = (measure.beats * 4) / measure.unit;
    const voice = childrenNamed(node, "voice")[0] ?? node;
    const scales: number[] = [];
    let cursor = 0;
    const readText = (item: XmlNode) => {
      const word = tempoWordKind(nodeText(item));
      if (word) events.words.push({ at: cursor, ...word });
    };
    for (const item of voice.children) {
      if (item.name === "Tempo") {
        const tempo = Number(childText(item, "tempo"));
        if (tempo > 0) events.tempo.push({ at: cursor, bpm: tempo * 60 });
        readText(item);
      } else if (item.name === "StaffText" || item.name === "SystemText") readText(item);
      else if (item.name === "Fermata") events.fermatas.push({ at: cursor });
      else if (item.name === "Breath") {
        if (/caesura/i.test(childText(item, "subtype") ?? ""))
          events.fermatas.push({ at: cursor, caesura: true });
      } else if (item.name === "Tuplet") {
        const ratio =
          Number(childText(item, "normalNotes")) / Number(childText(item, "actualNotes"));
        scales.push(Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
      } else if (item.name === "endTuplet") scales.pop();
      else if (item.name === "Chord" || item.name === "Rest") {
        const held =
          descendants(item, "Fermata").length > 0 ||
          descendants(item, "Articulation").some((mark) =>
            /fermata/i.test(childText(mark, "subtype") ?? ""),
          );
        if (held) events.fermatas.push({ at: cursor });
        cursor += museScoreQuarters(
          item,
          measureQuarters,
          scales.reduce((total, value) => total * value, 1),
        );
      }
    }
    if (!events.tempo.length) {
      const tempo = Number(childText(descendants(node, "Tempo")[0] ?? node, "tempo"));
      if (tempo > 0) events.tempo.push({ at: 0, bpm: tempo * 60 });
    }
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
    const next = placeEvents(measure, events);
    if (measure.bpm === null && carried !== null) measure.bpm = carried;
    carried = next;
    measures.push(measure);
  }
  return toTrack(title || fallbackTitle, measures);
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
