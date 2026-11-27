import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus } from "lucide-react";
import { useLanguage } from "../lib/language";
import {
  DEFAULT_REFERENCE_HZ,
  INSTRUMENT_STORAGE_KEY,
  instruments,
  isInstrumentId,
  parseReferenceHz,
  pitchReading,
  REFERENCE_STORAGE_KEY,
  type InstrumentId,
} from "../lib/tuner";
import {
  clampToneHz,
  frequencyToSlider,
  MAX_TONE_HZ,
  MIN_TONE_HZ,
  sliderToFrequency,
  stepTone,
} from "../lib/tone-generator";
import { AppPage } from "./app-page";
import { Picker } from "./picker";
import { Button } from "./ui/button";

type Waveform = "sine" | "triangle" | "square" | "sawtooth";
type ToneSettings = { frequency: number; volume: number; balance: number; waveform: Waveform };
type AudioResources = {
  context: AudioContext;
  oscillator: OscillatorNode;
  gain: GainNode;
  panner: StereoPannerNode;
};

function updateAudio(audio: AudioResources, settings: ToneSettings) {
  const now = audio.context.currentTime;
  audio.oscillator.type = settings.waveform;
  audio.oscillator.frequency.setTargetAtTime(settings.frequency, now, 0.01);
  audio.gain.gain.setTargetAtTime(settings.volume / 400, now, 0.01);
  audio.panner.pan.setTargetAtTime(settings.balance / 100, now, 0.01);
}

export function ToneGenerator() {
  const { t } = useLanguage();
  const [initial] = useState(() => {
    try {
      const saved = window.localStorage.getItem(INSTRUMENT_STORAGE_KEY);
      return {
        instrument: isInstrumentId(saved) ? saved : "concert",
        referenceHz: parseReferenceHz(window.localStorage.getItem(REFERENCE_STORAGE_KEY)),
        storageError: false,
      } as const;
    } catch (error) {
      console.warn("Could not read the tuner preferences.", error);
      return {
        instrument: "concert",
        referenceHz: DEFAULT_REFERENCE_HZ,
        storageError: true,
      } as const;
    }
  });
  const [instrument, setInstrument] = useState<InstrumentId>(initial.instrument);
  const [frequency, setFrequency] = useState(initial.referenceHz);
  const [volume, setVolume] = useState(15);
  const [balance, setBalance] = useState(0);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [status, setStatus] = useState<"idle" | "starting" | "playing">("idle");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(initial.storageError);
  const resources = useRef<AudioResources | null>(null);
  const pendingContext = useRef<AudioContext | null>(null);
  const generation = useRef(0);
  const settings = useRef<ToneSettings>({ frequency, volume, balance, waveform });

  function closeContext(context: AudioContext) {
    if (context.state !== "closed") {
      void context.close().catch((closeError: unknown) => {
        console.warn("Could not close the tone generator audio context.", closeError);
      });
    }
  }

  function release() {
    generation.current++;
    const audio = resources.current;
    resources.current = null;
    if (audio) {
      audio.oscillator.stop();
      closeContext(audio.context);
    }
    const pending = pendingContext.current;
    pendingContext.current = null;
    if (pending && pending !== audio?.context) closeContext(pending);
  }

  useEffect(() => () => release(), []);

  function changeAudioSettings(next: Partial<ToneSettings>) {
    settings.current = { ...settings.current, ...next };
    if (!resources.current) return;
    try {
      updateAudio(resources.current, settings.current);
    } catch (audioError) {
      console.error("Could not update tone generator audio.", audioError);
      release();
      setStatus("idle");
      setError(t("Could not play tone generator audio."));
    }
  }

  function setTone(next: number) {
    const value = clampToneHz(next);
    setFrequency(value);
    changeAudioSettings({ frequency: value });
  }

  async function start() {
    setError("");
    if (!window.AudioContext) {
      setError(t("Audio playback is not supported in this browser."));
      return;
    }
    setStatus("starting");
    const request = ++generation.current;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      pendingContext.current = context;
      await context.resume();
      if (request !== generation.current) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      const audio = { context, oscillator, gain, panner };
      oscillator.frequency.setValueAtTime(settings.current.frequency, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      updateAudio(audio, settings.current);
      oscillator.connect(gain);
      gain.connect(panner);
      panner.connect(context.destination);
      oscillator.start();
      pendingContext.current = null;
      resources.current = audio;
      setStatus("playing");
    } catch (audioError) {
      if (context) closeContext(context);
      if (request !== generation.current) return;
      pendingContext.current = null;
      console.error("Could not start tone generator audio.", audioError);
      setStatus("idle");
      setError(t("Could not start tone generator audio."));
    }
  }

  const reading = pitchReading(frequency, instrument, initial.referenceHz);

  return (
    <AppPage app="/apps/tone-generator">
      <section className="relative">
        <div className="relative z-10 space-y-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("Frequency")}
            </p>
            <div className="mt-2 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem] sm:gap-8">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Decrease frequency")}
                disabled={frequency <= MIN_TONE_HZ}
                onClick={() => setTone(Number((Number(frequency.toFixed(1)) - 0.1).toFixed(1)))}
              >
                <Minus size={20} />
              </Button>
              <div className="flex min-w-0 items-baseline justify-center gap-2">
                <output
                  aria-label={t("Frequency")}
                  className="font-heading text-5xl font-bold leading-none text-primary sm:text-6xl"
                >
                  {Number(frequency.toFixed(1))}
                </output>
                <span className="text-sm font-bold text-muted-foreground">Hz</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Increase frequency")}
                disabled={frequency >= MAX_TONE_HZ}
                onClick={() => setTone(Number((Number(frequency.toFixed(1)) + 0.1).toFixed(1)))}
              >
                <Plus size={20} />
              </Button>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={frequencyToSlider(frequency)}
              aria-label={t("Frequency")}
              aria-valuetext={`${frequency.toFixed(1)} Hz`}
              className="mt-5 h-2 w-full cursor-pointer accent-primary"
              onChange={(event) =>
                setTone(Number(sliderToFrequency(Number(event.target.value)).toFixed(1)))
              }
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>20 Hz</span>
              <span>20,000 Hz</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("Previous note")}
              onClick={() => setTone(stepTone(frequency, initial.referenceHz, -1))}
            >
              <Minus />
            </Button>
            <div className="min-w-32 text-center">
              <p className="text-xs font-semibold text-muted-foreground">{t("Written note")}</p>
              <p className="font-heading text-3xl font-bold text-primary">
                {reading.note}
                {reading.octave}
              </p>
              <p className="text-xs text-muted-foreground">
                {reading.cents > 0 ? "+" : ""}
                {reading.cents} {t("cents")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("Next note")}
              onClick={() => setTone(stepTone(frequency, initial.referenceHz, 1))}
            >
              <Plus />
            </Button>
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              size="icon-lg"
              className="size-14 rounded-full shadow-md"
              aria-label={t(
                status === "playing"
                  ? "Stop tone"
                  : status === "starting"
                    ? "Starting tone…"
                    : "Play tone",
              )}
              title={t(
                status === "playing"
                  ? "Stop tone"
                  : status === "starting"
                    ? "Starting tone…"
                    : "Play tone",
              )}
              aria-pressed={status === "playing"}
              disabled={status === "starting"}
              onClick={() => {
                if (status === "playing") {
                  release();
                  setStatus("idle");
                } else {
                  void start();
                }
              }}
            >
              {status === "playing" ? <Pause /> : <Play />}
            </Button>
          </div>

          <div className="grid gap-5 rounded-2xl border bg-card/80 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <label htmlFor="tone-instrument" className="mb-2 block font-semibold">
                {t("Your instrument")}
              </label>
              <Picker
                id="tone-instrument"
                value={instrument}
                className="w-full"
                contentPosition="popper"
                contentClassName="max-h-[min(18rem,var(--radix-select-content-available-height))]"
                onValueChange={(value) => {
                  if (!isInstrumentId(value)) return;
                  setInstrument(value);
                  try {
                    window.localStorage.setItem(INSTRUMENT_STORAGE_KEY, value);
                    setStorageError(false);
                  } catch (saveError) {
                    console.warn("Could not save the tuner preference.", saveError);
                    setStorageError(true);
                  }
                }}
                options={instruments.map((item) => ({ value: item.id, label: t(item.label) }))}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Notes match your written part. Sounding frequency stays the same.")}
              </p>
              {storageError && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {t("Your tuner settings could not be saved on this device.")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="tone-waveform" className="mb-2 block font-semibold">
                {t("Waveform")}
              </label>
              <Picker
                id="tone-waveform"
                value={waveform}
                className="w-full"
                onValueChange={(value) => {
                  if (
                    value === "sine" ||
                    value === "triangle" ||
                    value === "square" ||
                    value === "sawtooth"
                  ) {
                    setWaveform(value);
                    changeAudioSettings({ waveform: value });
                  }
                }}
                options={[
                  { value: "sine", label: t("Sine") },
                  { value: "triangle", label: t("Triangle wave") },
                  { value: "square", label: t("Square wave") },
                  { value: "sawtooth", label: t("Sawtooth") },
                ]}
              />
              <p className="mt-2 text-xs text-muted-foreground">A4 = {initial.referenceHz} Hz</p>
            </div>
            <div>
              <label htmlFor="tone-volume" className="flex justify-between font-semibold">
                <span>{t("Volume")}</span>
                <span>{volume}%</span>
              </label>
              <input
                id="tone-volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                className="mt-3 h-2 w-full cursor-pointer accent-primary"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setVolume(value);
                  changeAudioSettings({ volume: value });
                }}
              />
            </div>
            <div>
              <label htmlFor="tone-balance" className="flex justify-between font-semibold">
                <span>{t("Balance")}</span>
                <span>
                  {balance === 0
                    ? t("Center")
                    : `${Math.abs(balance)}% ${t(balance < 0 ? "Left" : "Right")}`}
                </span>
              </label>
              <input
                id="tone-balance"
                type="range"
                min="-100"
                max="100"
                value={balance}
                aria-valuetext={
                  balance === 0
                    ? t("Center")
                    : `${Math.abs(balance)}% ${t(balance < 0 ? "Left" : "Right")}`
                }
                className="mt-3 h-2 w-full cursor-pointer accent-primary"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setBalance(value);
                  changeAudioSettings({ balance: value });
                }}
              />
            </div>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {t(
              "Start at a low volume. Prolonged or loud tones, especially at extreme frequencies, can damage your hearing.",
            )}
          </p>
          {error && (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>
    </AppPage>
  );
}
