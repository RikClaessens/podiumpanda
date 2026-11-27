import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Download, FileText, Pause, Play, Upload } from "lucide-react";
import { useLanguage } from "../lib/language";
import { AppPage } from "./app-page";
import { ClickTrackView } from "./click-track-view";
import { ClickSoundPicker, useClickSound } from "./click-sound-picker";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { scheduleClick } from "../lib/click-audio";
import { trackToMidi, trackToWav } from "../lib/click-export";
import { ImportError, importScoreFile } from "../lib/click-import";
import {
  clickAtSeconds,
  EXAMPLE_TRACK_TEXT,
  clickTimes,
  formatTrackText,
  parseTrackText,
  trackSeconds,
  type Click,
  type ClickTrack,
} from "../lib/click-track";

const sampleTrack: ClickTrack = {
  title: "",
  countIn: 1,
  bars: 16,
  sections: [{ bar: 1, beats: 4, unit: 4, bpm: 100 }],
};

function formatDuration(seconds: number) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function download(bytes: Uint8Array, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ClickTrackApp() {
  const { t } = useLanguage();
  const [text, setText] = useState(() => formatTrackText(sampleTrack));
  const [fromBar, setFromBar] = useState("1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState({ bar: 0, bpm: 0, index: 0, beat: 0 });
  const [error, setError] = useState("");
  const audioContext = useRef<AudioContext | null>(null);
  const { sound, change: changeSound, saveFailed } = useClickSound();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  const session = useRef<{ clicks: Click[]; origin: number } | null>(null);
  const parsed = useMemo(() => parseTrackText(text), [text]);
  const track = "track" in parsed ? parsed.track : null;
  const seconds = track ? trackSeconds(track, { countIn: false }) : 0;

  useEffect(
    () => () => {
      if (audioContext.current && audioContext.current.state !== "closed")
        void audioContext.current.close();
    },
    [],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const context = audioContext.current;
    const current = session.current;
    if (!context || !current) return;
    let next = 0;
    const tick = () => {
      const now = context.currentTime - current.origin;
      while (next < current.clicks.length && current.clicks[next].time < now + 0.15) {
        const click = current.clicks[next];
        scheduleClick(
          context,
          current.origin + click.time,
          click.accent,
          true,
          click.bar === 0,
          soundRef.current,
        );
        next++;
      }
      const active = now >= 0 ? clickAtSeconds(current.clicks, now) : undefined;
      if (active) {
        const bpm = Math.round(active.bpm);
        setPosition((previous) =>
          previous.index === active.index && previous.beat === active.beat && previous.bpm === bpm
            ? previous
            : { bar: active.bar, bpm, index: active.index, beat: active.beat },
        );
      }
      if (next >= current.clicks.length && now > current.clicks[next - 1].time + 1)
        setIsPlaying(false);
    };
    tick();
    const interval = window.setInterval(tick, 25);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  async function start() {
    if (!track) return;
    setError("");
    if (!window.AudioContext) {
      setError(t("Audio playback is not supported in this browser."));
      return;
    }
    try {
      if (!audioContext.current || audioContext.current.state === "closed")
        audioContext.current = new AudioContext();
      await audioContext.current.resume();
    } catch (audioError) {
      console.error("Could not start click track audio.", audioError);
      setError(t("Could not start metronome audio."));
      return;
    }
    const all = clickTimes(track);
    const startBar = Math.max(1, Math.floor(Number(fromBar)) || 1);
    const first = startBar > 1 ? all.findIndex((click) => click.bar >= startBar) : 0;
    if (first < 0) {
      setError(t("That bar is beyond the end of the track."));
      return;
    }
    const offset = all[first].time;
    session.current = {
      clicks: all.slice(first).map((click) => ({ ...click, time: click.time - offset })),
      origin: audioContext.current.currentTime + 0.1,
    };
    setPosition({
      bar: all[first].bar,
      bpm: Math.round(all[first].bpm),
      index: all[first].index,
      beat: all[first].beat,
    });
    setIsPlaying(true);
  }

  async function load(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const imported = await importScoreFile(file.name, new Uint8Array(await file.arrayBuffer()));
      setIsPlaying(false);
      setText(formatTrackText(imported));
      setFromBar("1");
    } catch (importError) {
      setError(
        importError instanceof ImportError
          ? t(importError.message)
          : t("This file could not be read."),
      );
    }
  }

  const fileName =
    (track?.title || "click-track").replace(/[^\w\- ]+/g, "").trim() || "click-track";

  return (
    <AppPage app="/apps/click-track">
      <section className="relative space-y-6">
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload size={16} />
              {t("Open a score or MIDI file")}
              <input
                type="file"
                className="sr-only"
                accept=".mid,.midi,.mscz,.mscx,.mxl,.musicxml,.xml"
                onChange={(event) => {
                  void load(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
          <p className="text-xs text-muted-foreground">
            {t(
              "MIDI, MuseScore (.mscz, .mscx) and MusicXML (.mxl, .musicxml). Files stay on this device.",
            )}
          </p>
        </div>

        <div className="relative z-10 field">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="click-track-text"
              className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              {t("Click Track")}
            </label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsPlaying(false);
                  setText(EXAMPLE_TRACK_TEXT);
                  setFromBar("1");
                }}
              >
                <FileText size={15} />
                {t("Insert example")}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("Notation help")}
                    title={t("Notation help")}
                  >
                    <CircleHelp size={18} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto text-sm"
                >
                  <h2 className="text-lg font-semibold">{t("Notation help")}</h2>
                  <p>{t("Each line is a header, a section row or a comment.")}</p>
                  <dl className="space-y-2">
                    <div>
                      <dt className="font-mono font-semibold">title: Name</dt>
                      <dd className="text-muted-foreground">
                        {t("Optional name, used for the downloaded files.")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono font-semibold">count-in: 2</dt>
                      <dd className="text-muted-foreground">
                        {t("Bars of count-in before bar 1, from 0 to 8. It sounds slightly lower.")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono font-semibold">bars: 28</dt>
                      <dd className="text-muted-foreground">
                        {t("Total number of bars, not counting the count-in.")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono font-semibold">1 4/4 96</dt>
                      <dd className="text-muted-foreground">
                        {t(
                          "Section row: from this bar on, use this time signature and tempo. The first row must be bar 1. The tempo is always in quarter notes per minute.",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono font-semibold">13 4/4 100-&gt;140</dt>
                      <dd className="text-muted-foreground">
                        {t(
                          "Gradual tempo change: the tempo moves in a straight line up to the next row, or to the end of the track.",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono font-semibold">fermata: 8 3 2</dt>
                      <dd className="text-muted-foreground">
                        {t(
                          "Fermata: in bar 8, beat 3 is held for 2 extra seconds before the next click. The seconds are optional (2 by default). MIDI files hold at most about 16 seconds.",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono font-semibold"># comment</dt>
                      <dd className="text-muted-foreground">
                        {t("Lines starting with # are ignored.")}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-muted-foreground">
                    {t(
                      "The click follows the bottom number of the time signature: 6/8 gives six clicks per bar, with an accent on the first. Imported scores keep their repeats, endings and jumps, so the click follows the played order. Fermatas in imported scores are not detected. Exports include the count-in.",
                    )}
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {isPlaying && track ? (
            <ClickTrackView track={track} index={position.index} beat={position.beat} />
          ) : (
            <>
              <textarea
                id="click-track-text"
                spellCheck={false}
                rows={12}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setIsPlaying(false);
                }}
                className="w-full rounded-2xl border bg-card/80 p-4 font-mono text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-ring"
                aria-invalid={track === null}
              />
              {"error" in parsed ? (
                <p role="alert" className="text-sm text-destructive">
                  {parsed.error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("{bars} bars · {duration}", {
                    bars: parsed.track.bars,
                    duration: formatDuration(seconds),
                  })}
                </p>
              )}
            </>
          )}
        </div>

        <ClickSoundPicker
          className="relative z-10 w-full max-w-xs"
          sound={sound}
          onChange={changeSound}
          saveFailed={saveFailed}
        />

        <div className="relative z-10 flex flex-wrap items-end gap-3">
          <Button
            type="button"
            size="icon-lg"
            className={`size-14 rounded-full shadow-md ${isPlaying ? "bg-coral text-white hover:bg-coral/85 focus-visible:ring-coral/40" : ""}`}
            aria-label={t(isPlaying ? "Stop click track" : "Play click track")}
            title={t(isPlaying ? "Stop click track" : "Play click track")}
            aria-pressed={isPlaying}
            disabled={!track}
            onClick={() => (isPlaying ? setIsPlaying(false) : void start())}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </Button>
          <div className="field w-28">
            <label htmlFor="click-from-bar">{t("Start at bar")}</label>
            <Input
              id="click-from-bar"
              type="number"
              min={1}
              inputMode="numeric"
              value={fromBar}
              onChange={(event) => setFromBar(event.target.value)}
            />
          </div>
          <div className="min-w-20 text-center" aria-live="off">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("Bar")}
            </p>
            <p className="font-heading text-4xl font-bold leading-none text-primary tabular-nums">
              {isPlaying && position.bar > 0 ? position.bar : "—"}
            </p>
          </div>
          <div className="min-w-20 text-center" aria-live="off">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("BPM")}
            </p>
            <p className="font-heading text-4xl font-bold leading-none text-primary tabular-nums">
              {isPlaying && position.bpm > 0 ? position.bpm : "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              disabled={!track}
              onClick={() => track && download(trackToMidi(track), "audio/midi", `${fileName}.mid`)}
            >
              <Download size={16} />
              MIDI
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!track}
              onClick={() => track && download(trackToWav(track), "audio/wav", `${fileName}.wav`)}
            >
              <Download size={16} />
              WAV
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    </AppPage>
  );
}
