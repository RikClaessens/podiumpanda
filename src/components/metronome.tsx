import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Music2,
  Music3,
  Music4,
  Pause,
  Play,
  Plus,
  Timer,
} from "lucide-react";
import { useLanguage } from "../lib/language";
import {
  BEAT_UNITS,
  calculateTapTempo,
  clampBeatsPerBar,
  clampBpm,
  MAX_BPM,
  MIN_BPM,
  subdivisionIntervalSeconds,
} from "../lib/metronome";
import { Button } from "./ui/button";

function scheduleClick(context: AudioContext, time: number, accented: boolean, mainBeat: boolean) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const volume = accented ? 0.42 : mainBeat ? 0.24 : 0.1;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(accented ? 1320 : mainBeat ? 880 : 560, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.06);
}

export function Metronome() {
  const { t } = useLanguage();
  const [bpm, setBpm] = useState(100);
  const [bpmDraft, setBpmDraft] = useState("100");
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [beatUnit, setBeatUnit] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [error, setError] = useState("");
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    },
    [],
  );

  useEffect(() => {
    if (!isPlaying) return;

    const context = audioContext.current;
    if (!context) {
      console.error("Metronome audio context is unavailable while playing.");
      return;
    }

    let step = 0;
    let nextNoteTime = context.currentTime + 0.05;
    const visualTimers = new Set<number>();
    const schedule = () => {
      const beatIntervalSeconds = subdivisionIntervalSeconds(bpm, beatUnit, subdivision);
      if (nextNoteTime < context.currentTime) {
        const skippedSteps = Math.ceil((context.currentTime - nextNoteTime) / beatIntervalSeconds);
        step = (step + skippedSteps) % (beatsPerBar * subdivision);
        nextNoteTime += skippedSteps * beatIntervalSeconds;
      }

      while (nextNoteTime < context.currentTime + 0.1) {
        const beat = Math.floor(step / subdivision) % beatsPerBar;
        const isMainBeat = step % subdivision === 0;
        try {
          scheduleClick(context, nextNoteTime, beat === 0 && isMainBeat, isMainBeat);
        } catch (audioError) {
          console.error("Could not schedule metronome audio.", audioError);
          setError(t("Could not play metronome audio."));
          setIsPlaying(false);
          return;
        }

        const timer = window.setTimeout(
          () => {
            setActiveBeat(beat);
            visualTimers.delete(timer);
          },
          Math.max(0, (nextNoteTime - context.currentTime) * 1000),
        );
        visualTimers.add(timer);
        nextNoteTime += beatIntervalSeconds;
        step += 1;
      }
    };

    schedule();
    const interval = window.setInterval(schedule, 25);
    return () => {
      window.clearInterval(interval);
      for (const timer of visualTimers) window.clearTimeout(timer);
    };
  }, [beatUnit, bpm, beatsPerBar, isPlaying, subdivision, t]);

  async function start() {
    setError("");
    if (!window.AudioContext) {
      setError(t("Audio playback is not supported in this browser."));
      return;
    }

    try {
      if (!audioContext.current || audioContext.current.state === "closed") {
        audioContext.current = new AudioContext();
      }
      await audioContext.current.resume();
      setIsPlaying(true);
    } catch (audioError) {
      console.error("Could not start metronome audio.", audioError);
      setError(t("Could not start metronome audio."));
    }
  }

  function setTempo(value: number) {
    const next = clampBpm(value);
    setBpm(next);
    setBpmDraft(String(next));
  }

  function tapTempo() {
    const now = performance.now();
    const recentTaps = [...tapTimes.filter((time) => now - time < 2500), now].slice(-6);
    setTapTimes(recentTaps);
    const tappedTempo = calculateTapTempo(recentTaps);
    if (tappedTempo !== null) setTempo(tappedTempo);
  }

  return (
    <main className="page-enter mx-auto max-w-3xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
      <section className="space-y-6 sm:space-y-8">
        <header className="relative min-h-12 pr-28">
          <div
            className="pointer-events-none absolute top-1 right-1 flex items-center gap-1"
            aria-hidden="true"
          >
            <Music2 className="text-primary opacity-[0.12]" size={36} />
            <Music3 className="text-coral-foreground opacity-[0.12]" size={22} />
            <Music4 className="text-yellow opacity-[0.14]" size={20} />
          </div>
          <div className="relative space-y-1">
            <h1 className="text-3xl font-bold text-primary sm:text-4xl">{t("Metronome")}</h1>
          </div>
        </header>

        <div className="space-y-6 sm:space-y-8">
          <section className="tempo-card mx-auto w-full max-w-2xl rounded-3xl bg-secondary/60 px-3 py-4 sm:px-6 sm:py-6">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] grid-rows-[auto_auto] items-center gap-x-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem] sm:gap-x-8">
              <label
                htmlFor="metronome-bpm"
                className="col-start-2 row-start-1 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {t("Tempo")}
              </label>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="col-start-1 row-start-2"
                aria-label={t("Decrease tempo")}
                onClick={() => setTempo(bpm - 1)}
              >
                <ArrowDown size={20} />
              </Button>
              <div className="col-start-2 row-start-2 min-w-0 text-center">
                <div className="flex items-baseline justify-center gap-2">
                  <input
                    id="metronome-bpm"
                    type="number"
                    min={MIN_BPM}
                    max={MAX_BPM}
                    inputMode="numeric"
                    value={bpmDraft}
                    aria-label={t("Tempo")}
                    className="w-28 border-0 bg-transparent p-0 text-center font-heading text-6xl font-bold leading-none tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:w-40 sm:text-7xl"
                    onChange={(event) => setBpmDraft(event.target.value)}
                    onBlur={() => {
                      const parsed = Number(bpmDraft);
                      setTempo(Number.isFinite(parsed) && parsed > 0 ? parsed : bpm);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <span className="text-sm font-bold text-muted-foreground">BPM</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="col-start-3 row-start-2"
                aria-label={t("Increase tempo")}
                onClick={() => setTempo(bpm + 1)}
              >
                <ArrowUp size={20} />
              </Button>
            </div>
            <input
              type="range"
              min={MIN_BPM}
              max={MAX_BPM}
              value={bpm}
              aria-label={t("Tempo")}
              className="mt-4 h-2 w-full cursor-pointer accent-primary"
              onChange={(event) => setTempo(Number(event.target.value))}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{MIN_BPM}</span>
              <span>{MAX_BPM}</span>
            </div>
          </section>

          <div
            aria-hidden="true"
            className="mx-auto flex max-w-[20rem] flex-wrap justify-center gap-2"
          >
            {Array.from({ length: beatsPerBar }, (_, index) => {
              const beat = index + 1;
              return (
                <span
                  key={beat}
                  className={`beat-light ${activeBeat === index ? "beat-light-active" : ""} ${
                    index === 0 ? "beat-light-accent" : ""
                  }`}
                />
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              size="icon-lg"
              className="size-14 rounded-full shadow-sm"
              aria-label={t(isPlaying ? "Stop metronome" : "Start metronome")}
              title={t(isPlaying ? "Stop metronome" : "Start metronome")}
              aria-pressed={isPlaying}
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                  setActiveBeat(-1);
                } else {
                  void start();
                }
              }}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </Button>
          </div>

          <fieldset className="space-y-3">
            <legend className="sr-only">{t("Time signature")}</legend>
            <div className="metronome-stepper mx-auto grid max-w-sm grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem] sm:gap-4">
              <div className="flex flex-col items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("Decrease beats per bar")}
                  disabled={beatsPerBar <= 1}
                  onClick={() => setBeatsPerBar(clampBeatsPerBar(beatsPerBar - 1))}
                >
                  <Minus size={18} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("Decrease beat unit")}
                  disabled={beatUnit <= BEAT_UNITS[0]}
                  onClick={() => {
                    const index = BEAT_UNITS.findIndex((unit) => unit === beatUnit);
                    setBeatUnit(BEAT_UNITS[Math.max(0, index - 1)]);
                  }}
                >
                  <Minus size={18} />
                </Button>
              </div>
              <div className="metronome-stepper-card mx-auto flex min-h-32 w-full max-w-56 flex-col items-center justify-center rounded-2xl border bg-card px-3 py-4 text-center">
                <output
                  className="font-heading text-4xl font-bold leading-[0.95] text-primary sm:text-5xl"
                  aria-label={t("Time signature value {beats} over {unit}", {
                    beats: beatsPerBar,
                    unit: beatUnit,
                  })}
                >
                  <span className="block">{beatsPerBar}</span>
                  <span className="my-1 block h-px w-8 bg-coral/60" aria-hidden="true" />
                  <span className="block">{beatUnit}</span>
                </output>
                <span className="mt-2 text-xs font-semibold text-muted-foreground sm:text-sm">
                  {t("Time signature")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("Increase beats per bar")}
                  disabled={beatsPerBar >= 16}
                  onClick={() => setBeatsPerBar(clampBeatsPerBar(beatsPerBar + 1))}
                >
                  <Plus size={18} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("Increase beat unit")}
                  disabled={beatUnit >= BEAT_UNITS[BEAT_UNITS.length - 1]}
                  onClick={() => {
                    const index = BEAT_UNITS.findIndex((unit) => unit === beatUnit);
                    setBeatUnit(BEAT_UNITS[Math.min(BEAT_UNITS.length - 1, index + 1)]);
                  }}
                >
                  <Plus size={18} />
                </Button>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="sr-only">{t("Subdivision")}</legend>
            <div className="metronome-stepper mx-auto grid max-w-sm grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem] sm:gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Decrease subdivision")}
                disabled={subdivision <= 1}
                onClick={() => setSubdivision(Math.max(1, subdivision - 1))}
              >
                <Minus size={18} />
              </Button>
              <div className="metronome-stepper-card mx-auto flex min-h-20 w-full max-w-56 flex-col items-center justify-center rounded-2xl border bg-card px-3 py-2 text-center">
                <output
                  className="font-heading text-3xl font-bold leading-none text-primary"
                  aria-label={t("Subdivision count {count}", { count: subdivision })}
                >
                  {subdivision}
                </output>
                <span className="mt-1 text-[0.6rem] font-semibold leading-tight text-muted-foreground">
                  {t("Subdivision")}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Increase subdivision")}
                disabled={subdivision >= 7}
                onClick={() => setSubdivision(Math.min(7, subdivision + 1))}
              >
                <Plus size={18} />
              </Button>
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex justify-center">
            <Button
              type="button"
              size="lg"
              className="h-12 w-full max-w-sm px-8"
              variant="outline"
              onClick={tapTempo}
            >
              <Timer size={20} />
              {t("Tap tempo")}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
