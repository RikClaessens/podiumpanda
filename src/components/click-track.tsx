import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  Link,
  Pause,
  Play,
  Upload,
} from "lucide-react";
import { useLanguage } from "../lib/language";
import { AppPage } from "./app-page";
import { ClickTrackView } from "./click-track-view";
import { ClickSoundPicker, useClickSound } from "./click-sound-picker";
import { Button } from "./ui/button";
import { Link as RouterLink } from "@tanstack/react-router";
import { ClickTrackHelp } from "./click-track-help";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Input } from "./ui/input";
import { scheduleClick } from "../lib/click-audio";
import { trackToMidi, trackToWav } from "../lib/click-export";
import { ImportError, importScoreFile } from "../lib/click-import";
import { decodeShare, sharedValue, shareUrl } from "../lib/click-share";
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

const STORAGE_KEY = "podiumpanda:click-track";

function savedState(): { text: string; fromBar: string } {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const { text, fromBar } = saved as Record<string, unknown>;
      if (typeof text === "string")
        return { text, fromBar: typeof fromBar === "string" ? fromBar : "1" };
    }
  } catch (error) {
    console.warn("Could not read the saved click track.", error);
  }
  return { text: formatTrackText(sampleTrack), fromBar: "1" };
}

export function ClickTrackApp() {
  const { t } = useLanguage();
  const [initial] = useState(savedState);
  const [text, setText] = useState(initial.text);
  const [fromBar, setFromBar] = useState(initial.fromBar);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState({ bar: 0, bpm: 0, index: 0, beat: 0 });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, fromBar }));
    } catch (saveError) {
      console.warn("Could not save the click track.", saveError);
    }
  }, [text, fromBar]);

  useEffect(() => {
    const value = sharedValue(window.location.hash);
    if (!value) return;
    let cancelled = false;
    void decodeShare(value).then((shared) => {
      if (cancelled) return;
      if (shared === null) setError(t("This share link could not be read."));
      else setText(shared);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function share() {
    setError("");
    try {
      await navigator.clipboard.writeText(await shareUrl(text, window.location));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (shareError) {
      console.warn("Could not copy the share link.", shareError);
      setError(t("Could not copy the share link."));
    }
  }

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
        const strength = click.sub
          ? "sub"
          : click.level === 3
            ? "accent"
            : click.level === 2
              ? "medium"
              : click.level === 1
                ? "beat"
                : null;
        if (strength)
          scheduleClick(
            context,
            current.origin + click.time,
            strength,
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
    const exact = all.findIndex((click) => click.bar === startBar);
    const first =
      startBar > 1 ? (exact >= 0 ? exact : all.findIndex((click) => click.bar >= startBar)) : 0;
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
              <Button type="button" variant="ghost" size="sm" onClick={() => void share()}>
                {copied ? <Check size={15} /> : <Link size={15} />}
                {copied ? t("Link copied") : t("Copy share link")}
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("Notation help")}
                    title={t("Notation help")}
                  >
                    <CircleHelp size={18} />
                  </Button>
                </SheetTrigger>
                <SheetContent title={t("Notation help")}>
                  <ClickTrackHelp />
                  <RouterLink
                    to="/apps/click-track/help"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <ExternalLink size={14} />
                    {t("Open on a separate page")}
                  </RouterLink>
                </SheetContent>
              </Sheet>
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
