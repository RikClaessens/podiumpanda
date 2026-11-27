import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Minus, Plus, Sparkles } from "lucide-react";
import { useLanguage } from "../lib/language";
import {
  DEFAULT_REFERENCE_HZ,
  detectPitch,
  instruments,
  isInstrumentId,
  MAX_REFERENCE_HZ,
  MIN_REFERENCE_HZ,
  parseReferenceHz,
  pitchReading,
  type InstrumentId,
} from "../lib/tuner";
import { AppPage } from "./app-page";
import { Picker } from "./picker";
import { Button } from "./ui/button";

const storageKey = "podiumpanda.tuner.instrument";
const referenceStorageKey = "podiumpanda.tuner.reference";

export function Tuner() {
  const { t } = useLanguage();
  const [initial] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return {
        instrument: isInstrumentId(saved) ? saved : "concert",
        referenceHz: parseReferenceHz(window.localStorage.getItem(referenceStorageKey)),
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
  const [referenceHz, setReferenceHz] = useState(initial.referenceHz);
  const referenceRef = useRef(referenceHz);
  const [storageError, setStorageError] = useState(initial.storageError);
  const [status, setStatus] = useState<"idle" | "requesting" | "listening">("idle");
  const [hasMicAccess, setHasMicAccess] = useState(false);
  const [error, setError] = useState("");
  const [frequency, setFrequency] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const resources = useRef<{ stream: MediaStream; context: AudioContext; timer: number } | null>(
    null,
  );
  const generation = useRef(0);

  function release() {
    generation.current++;
    const active = resources.current;
    resources.current = null;
    if (!active) return;
    window.clearInterval(active.timer);
    for (const track of active.stream.getTracks()) {
      track.onended = null;
      track.stop();
    }
    void active.context.close().catch((closeError: unknown) => {
      console.warn("Could not close the tuner audio context.", closeError);
    });
  }

  useEffect(() => () => release(), []);

  useEffect(() => {
    let permission: PermissionStatus | null = null;
    let active = true;
    const update = () => setHasMicAccess(permission?.state === "granted");
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (!active) return;
        permission = result;
        update();
        permission.addEventListener("change", update);
      })
      .catch((permissionError: unknown) => {
        console.warn("Could not read microphone permission.", permissionError);
      });
    return () => {
      active = false;
      permission?.removeEventListener("change", update);
    };
  }, []);

  function stop() {
    release();
    setStatus("idle");
    setFrequency(null);
    setHistory([]);
  }

  function savePreference(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
      setStorageError(false);
    } catch (saveError) {
      console.warn("Could not save the tuner preference.", saveError);
      setStorageError(true);
    }
  }

  function changeReference(next: number) {
    const clamped = Math.min(MAX_REFERENCE_HZ, Math.max(MIN_REFERENCE_HZ, next));
    referenceRef.current = clamped;
    setReferenceHz(clamped);
    setHistory([]);
    savePreference(referenceStorageKey, String(clamped));
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError(
        t("Microphone access is unavailable. Use a supported browser on HTTPS or localhost."),
      );
      return;
    }
    setStatus("requesting");
    const request = ++generation.current;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      setHasMicAccess(true);
      if (request !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (request !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      context.createMediaStreamSource(stream).connect(analyser);
      const sampleRate = context.sampleRate;
      const samples = new Float32Array(analyser.fftSize);
      let previousNote = "";
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        const detected = detectPitch(samples, sampleRate);
        setFrequency(detected);
        if (detected === null) {
          previousNote = "";
          setHistory([]);
          return;
        }
        const reading = pitchReading(detected, "concert", referenceRef.current);
        const note = `${reading.note}${reading.octave}`;
        const sameNote = note === previousNote;
        setHistory((previous) => [...(sameNote ? previous : []), reading.cents].slice(-50));
        previousNote = note;
      }, 100);
      resources.current = { stream, context, timer };
      for (const track of stream.getAudioTracks()) {
        track.onended = () => {
          stop();
          setError(t("The microphone stopped. Please start listening again."));
        };
      }
      setStatus("listening");
    } catch (startError) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") {
        void context.close().catch((closeError: unknown) => {
          console.warn("Could not close the tuner audio context.", closeError);
        });
      }
      if (request !== generation.current) return;
      console.warn("Could not start the tuner microphone.", startError);
      setStatus("idle");
      if (startError instanceof DOMException && startError.name === "NotAllowedError") {
        setHasMicAccess(false);
      }
      setError(
        startError instanceof DOMException && startError.name === "NotAllowedError"
          ? t("Microphone access was blocked. Allow it in your browser settings, then try again.")
          : t("The panda couldn't hear your microphone. Check your device and try again."),
      );
    }
  }

  const reading = frequency === null ? null : pitchReading(frequency, instrument, referenceHz);
  const inTune = reading !== null && Math.abs(reading.cents) <= 5;
  const points = history.map((cents, index) => `${index * 2},${50 - cents * 0.8}`).join(" ");

  return (
    <AppPage app="/apps/tuner">
      <section className="tuner-panel relative overflow-hidden rounded-[2rem] border p-5 sm:p-8">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <Button
            size="icon-lg"
            className={`size-12 rounded-full shadow-md ${status === "listening" ? "bg-coral text-white hover:bg-coral/85 focus-visible:ring-coral/40" : ""}`}
            aria-label={
              status === "requesting"
                ? t("Waiting for microphone…")
                : status === "listening"
                  ? t("Stop listening")
                  : t("Let the panda listen")
            }
            title={
              status === "requesting"
                ? t("Waiting for microphone…")
                : status === "listening"
                  ? t("Stop listening")
                  : t("Let the panda listen")
            }
            disabled={status === "requesting"}
            onClick={status === "listening" ? stop : () => void start()}
          >
            {status === "listening" ? (
              <MicOff className="size-5" aria-hidden="true" />
            ) : (
              <Mic className="size-5" aria-hidden="true" />
            )}
          </Button>
          <div className="flex items-center gap-1 rounded-full border bg-card/70 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={t("Lower reference pitch")}
              disabled={referenceHz <= MIN_REFERENCE_HZ}
              onClick={() => changeReference(referenceHz - 1)}
            >
              <Minus />
            </Button>
            <output
              aria-live="polite"
              aria-label={t("Reference pitch")}
              className="min-w-24 text-center text-xs font-semibold tabular-nums text-muted-foreground"
            >
              A4 = {referenceHz} Hz
            </output>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={t("Raise reference pitch")}
              disabled={referenceHz >= MAX_REFERENCE_HZ}
              onClick={() => changeReference(referenceHz + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>

        <div className="relative z-10 mt-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("Written note")}
          </p>
          <div className="tuner-note mt-1 flex min-h-32 items-center justify-center font-heading font-bold leading-none text-primary">
            {reading ? (
              <>
                <span>{reading.note}</span>
                <span className="mt-10 text-3xl text-muted-foreground">{reading.octave}</span>
              </>
            ) : (
              <span className="text-primary/30">—</span>
            )}
          </div>
          <p
            className={`min-h-7 text-sm font-bold ${inTune ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
          >
            {reading
              ? inTune
                ? t("Pitch perfect!")
                : reading.cents < 0
                  ? t("A little flat")
                  : t("A little sharp")
              : status === "listening"
                ? t("Listening for your note…")
                : t("Ready when you are")}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {reading
              ? `${reading.frequency.toFixed(1)} Hz · ${reading.cents > 0 ? "+" : ""}${reading.cents} ${t("cents")}`
              : "— Hz · — " + t("cents")}
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-7 max-w-xl">
          <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground">
            <span>{t("Flat")} −50</span>
            <span>0</span>
            <span>+50 {t("Sharp")}</span>
          </div>
          <div className="tuner-meter relative h-5 rounded-full">
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary/40" />
            {reading && (
              <div
                className="tuner-marker absolute top-1/2 size-6 rounded-full border-4 border-card bg-primary shadow-md"
                style={{ left: `${50 + reading.cents}%` }}
              />
            )}
          </div>
          <div
            className="tuner-history relative mt-5 h-20 overflow-hidden rounded-2xl border bg-card/50"
            aria-hidden="true"
          >
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-primary/25" />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polyline
                points={points}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t("Your pitch over time")}
          </p>
        </div>

        <div className="relative z-10 mt-6 rounded-2xl border bg-card/80 p-4 sm:p-5">
          <label htmlFor="tuner-instrument" className="mb-2 block font-semibold">
            {t("Your instrument")}
          </label>
          <Picker
            id="tuner-instrument"
            value={instrument}
            className="w-full"
            contentPosition="popper"
            contentClassName="max-h-[min(18rem,var(--radix-select-content-available-height))]"
            onValueChange={(value) => {
              if (!isInstrumentId(value)) return;
              setInstrument(value);
              savePreference(storageKey, value);
            }}
            options={instruments.map((item) => ({ value: item.id, label: t(item.label) }))}
          />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t("Notes match your written part. Sounding frequency stays the same.")}
          </p>
          {storageError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {t("Your tuner settings could not be saved on this device.")}
            </p>
          )}
        </div>

        <div className="relative z-10 mt-6 flex flex-col items-center text-center">
          {!hasMicAccess && (
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t(
                "The panda needs your microphone to check if you're pitch perfect. Play one sustained note and let those panda ears work!",
              )}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles size={14} aria-hidden="true" />
            {t("Your audio stays on this device.")}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>
    </AppPage>
  );
}
