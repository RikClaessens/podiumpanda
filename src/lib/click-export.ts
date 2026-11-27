import { barPulses, clickTimes, expandBars, trackSeconds, type ClickTrack } from "./click-track";

const PPQ = 480;
const ACCENT_NOTE = 34;
const CLICK_NOTE = 33;
const COUNT_IN_ACCENT_NOTE = 76;
const COUNT_IN_NOTE = 77;
const SUB_NOTE = 37;

function varLength(value: number) {
  const bytes = [value & 0x7f];
  while ((value >>= 7) > 0) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}

type TimedEvent = { tick: number; order: number; bytes: number[] };

function trackChunk(events: TimedEvent[], endTick: number) {
  const body: number[] = [];
  let previous = 0;
  for (const event of [...events].sort((a, b) => a.tick - b.tick || a.order - b.order)) {
    body.push(...varLength(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }
  body.push(...varLength(Math.max(0, endTick - previous)), 0xff, 0x2f, 0x00);
  const length = body.length;
  return [
    0x4d,
    0x54,
    0x72,
    0x6b,
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...body,
  ];
}

const textMeta = (type: number, text: string) => {
  const data = [...new TextEncoder().encode(text)];
  return [0xff, type, ...varLength(data.length), ...data];
};

export function trackToMidi(track: ClickTrack): Uint8Array {
  const tempoEvents: TimedEvent[] = [
    { tick: 0, order: 0, bytes: textMeta(0x03, track.title || "Click track") },
  ];
  const clickEvents: TimedEvent[] = [{ tick: 0, order: 0, bytes: textMeta(0x03, "Click") }];
  let tick = 0;
  let signature = "";
  let tempo = -1;
  for (const plan of expandBars(track)) {
    const unitTicks = (PPQ * 4) / plan.unit;
    if (`${plan.beats}/${plan.unit}` !== signature) {
      signature = `${plan.beats}/${plan.unit}`;
      tempoEvents.push({
        tick,
        order: 1,
        bytes: [0xff, 0x58, 0x04, plan.beats, Math.log2(plan.unit), 24, 8],
      });
    }
    let pulseStart = tick;
    for (const pulse of barPulses(plan)) {
      const pulseTicks = pulse.units * unitTicks;
      // A MIDI tempo holds at most 16.7 seconds per quarter note, which caps long fermatas.
      const microseconds = Math.min(
        0xffffff,
        Math.round((pulse.seconds * 1_000_000 * PPQ) / pulseTicks),
      );
      if (microseconds !== tempo) {
        tempo = microseconds;
        tempoEvents.push({
          tick: pulseStart,
          order: 2,
          bytes: [
            0xff,
            0x51,
            0x03,
            (microseconds >> 16) & 0xff,
            (microseconds >> 8) & 0xff,
            microseconds & 0xff,
          ],
        });
      }
      const countIn = plan.bar === 0;
      const strong = pulse.level === 3;
      const note = strong
        ? countIn
          ? COUNT_IN_ACCENT_NOTE
          : ACCENT_NOTE
        : countIn
          ? COUNT_IN_NOTE
          : CLICK_NOTE;
      const length = Math.max(1, Math.floor(Math.min(pulseTicks, unitTicks) / 4));
      const hits = [
        ...(pulse.level === 0
          ? []
          : [{ at: pulseStart, note, velocity: [0, 70, 96, 112][pulse.level] }]),
        ...pulse.subOffsets.map((offset) => ({
          at: pulseStart + Math.round((pulseTicks * offset) / pulse.seconds),
          note: SUB_NOTE,
          velocity: 60,
        })),
      ];
      for (const hit of hits)
        clickEvents.push(
          { tick: hit.at, order: 1, bytes: [0x99, hit.note, hit.velocity] },
          { tick: hit.at + length, order: 0, bytes: [0x89, hit.note, 0] },
        );
      pulseStart += pulseTicks;
    }
    tick = pulseStart;
  }
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, (PPQ >> 8) & 0xff, PPQ & 0xff];
  return Uint8Array.from([
    ...header,
    ...trackChunk(tempoEvents, tick),
    ...trackChunk(clickEvents, tick),
  ]);
}

export function trackToWav(track: ClickTrack, sampleRate = 44100): Uint8Array {
  const clicks = clickTimes(track);
  const total = trackSeconds(track);
  const samples = new Int16Array(Math.ceil(total * sampleRate) + sampleRate / 10);
  const burst = Math.floor(sampleRate * 0.06);
  for (const click of clicks) {
    const start = Math.round(click.time * sampleRate);
    if (click.level === 0 && click.sub === 0) continue;
    const pitch = click.sub > 0 ? 0.65 : click.level === 2 ? 0.88 : 1;
    const frequency =
      (click.bar === 0 ? (click.accent ? 990 : 660) : click.accent ? 1320 : 880) * pitch;
    const volume = click.accent ? 0.7 : click.sub > 0 ? 0.25 : click.level === 2 ? 0.55 : 0.45;
    for (let index = 0; index < burst && start + index < samples.length; index++) {
      const envelope = Math.exp((-index / burst) * 6) * Math.min(1, index / (sampleRate * 0.002));
      samples[start + index] = Math.round(
        Math.sin((2 * Math.PI * frequency * index) / sampleRate) * envelope * volume * 32767,
      );
    }
  }
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) =>
    [...text].forEach((character, index) => (bytes[offset + index] = character.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return bytes;
}
