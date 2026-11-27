import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importMuseScore, importMusicXml, importScoreFile, unroll } from "./click-import";
import { parseXml } from "./xml";

const measureXml = (extra = "", attributes = "") =>
  `<measure number="1">${attributes}${extra}<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></measure>`;

function musicXml(measures: string[]) {
  return `<?xml version="1.0"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise><work><work-title>Waltz &amp; March</work-title></work><part-list/><part id="P1">${measures.join("")}</part></score-partwise>`;
}

describe("xml reader", () => {
  it("reads nested nodes, attributes, entities and CDATA", () => {
    const root = parseXml(
      `<?xml version="1.0"?><a x="1 &lt; 2"><!-- c --><b>t&amp;<![CDATA[<u>]]></b><c/></a>`,
    );
    expect(root.attrs.x).toBe("1 < 2");
    expect(root.children.map((node) => node.name)).toEqual(["b", "c"]);
    expect(root.children[0].text).toBe("t&<u>");
    expect(() => parseXml("<a><b></a>")).toThrow();
  });
});

describe("MusicXML import", () => {
  it("reads time signatures, tempo marks, titles and pickup bars", () => {
    const track = importMusicXml(
      musicXml([
        `<measure number="0" implicit="yes"><attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>60</per-minute></metronome></direction-type></direction><note><duration>2</duration></note></measure>`,
        measureXml().replace("<duration>4", "<duration>6"),
        `<measure number="2"><direction><sound tempo="72"/></direction><note><duration>6</duration></note></measure>`,
      ]),
    );
    expect(track.title).toBe("Waltz & March");
    expect(track.bars).toBe(3);
    expect(track.sections).toEqual([
      { bar: 1, beats: 1, unit: 4, bpm: 90 },
      { bar: 2, beats: 3, unit: 4, bpm: 90 },
      { bar: 3, beats: 3, unit: 4, bpm: 72 },
    ]);
  });

  it("unrolls repeats with first and second endings", () => {
    const track = importMusicXml(
      musicXml([
        measureXml(
          "",
          "<attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes>",
        ),
        measureXml(`<barline><repeat direction="forward"/></barline>`),
        measureXml(
          `<barline><ending number="1" type="start"/></barline><barline><ending number="1" type="stop"/><repeat direction="backward"/></barline>`,
        ),
        measureXml(
          `<barline><ending number="2" type="start"/></barline><barline><ending number="2" type="stop"/></barline>`,
        ),
        measureXml(),
      ]),
    );
    // 1 2 3(1st ending) 2 4(2nd ending) 5
    expect(track.bars).toBe(6);
  });

  it("rejects non MusicXML content", () => {
    expect(() => importMusicXml("<foo/>")).toThrow(/partwise/);
  });
});

describe("unroll", () => {
  const m = (extra: Partial<Parameters<typeof unroll>[0][number]> = {}) => ({
    beats: 4,
    unit: 4,
    bpm: null,
    marks: [] as string[],
    ...extra,
  });

  it("plays D.S. al coda", () => {
    const order = unroll([
      m(),
      m({ marks: ["segno"] }),
      m({ marks: ["coda"], jump: { to: "segno", until: "coda", continueAt: "codab" } }),
      m(),
      m({ marks: ["codab"] }),
    ]);
    expect(order).toEqual([0, 1, 2, 1, 2, 4]);
  });

  it("plays D.C. al fine and ignores repeats on the way back", () => {
    const order = unroll([m(), m({ afterJump: {}, repeatEnd: 2 }), m({ jump: { to: "start" } })]);
    expect(order).toEqual([0, 1, 0, 1, 2, 0, 1]);
  });
});

describe("MuseScore import", () => {
  const mscx = `<museScore><Score><metaTag name="workTitle">Song</metaTag><Part><Staff id="1"/></Part>
    <Staff id="1">
      <Measure><voice><TimeSig><sigN>3</sigN><sigD>4</sigD></TimeSig><Tempo><tempo>1.5</tempo></Tempo><startRepeat/></voice></Measure>
      <Measure><voice><endRepeat>2</endRepeat></voice></Measure>
      <Measure len="1/4"><voice/></Measure>
    </Staff></Score></museScore>`;

  it("reads tempo (quarter notes per second), repeats and pickup lengths", () => {
    const track = importMuseScore(mscx);
    expect(track.title).toBe("Song");
    expect(track.bars).toBe(5);
    expect(track.sections).toEqual([
      { bar: 1, beats: 3, unit: 4, bpm: 90 },
      { bar: 5, beats: 1, unit: 4, bpm: 90 },
    ]);
  });

  it("reads .mscz and .mxl archives, including deflated entries", async () => {
    const zip = (name: string, content: string, method: 0 | 8) => {
      const data = Buffer.from(content);
      const stored = method === 8 ? deflateRawSync(data) : data;
      const nameBytes = Buffer.from(name);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(method, 8);
      local.writeUInt32LE(stored.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(method, 10);
      central.writeUInt32LE(stored.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(nameBytes.length, 28);
      central.writeUInt32LE(0, 42);
      const end = Buffer.alloc(22);
      end.writeUInt32LE(0x06054b50, 0);
      end.writeUInt16LE(1, 8);
      end.writeUInt16LE(1, 10);
      const entry = Buffer.concat([local, nameBytes, stored]);
      end.writeUInt32LE(central.length + nameBytes.length, 12);
      end.writeUInt32LE(entry.length, 16);
      return new Uint8Array(Buffer.concat([entry, central, nameBytes, end]));
    };
    expect((await importScoreFile("song.mscz", zip("song.mscx", mscx, 8))).bars).toBe(5);
    expect((await importScoreFile("song.mscz", zip("song.mscx", mscx, 0))).title).toBe("Song");
    await expect(importScoreFile("song.txt", new Uint8Array())).rejects.toThrow(/Unsupported/);
  });
});
