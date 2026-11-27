import { useEffect, useRef, useState } from "react";
import { RotateCw, Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "../lib/language";
import { scheduleClick } from "../lib/click-audio";
import {
  nextWheelRotation,
  randomWheelIndex,
  wheelBoundaryIndex,
  wheelEntries,
  wheelRotationForIndex,
  wheelSlicePath,
  wheelStateSchema,
  WHEEL_STORAGE_KEY,
  type WheelState,
} from "../lib/wheel-of-fortune";
import { AppPage } from "./app-page";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const colors = ["#f8cb70", "#f7a7a4", "#d0b4f4", "#a9d8d1", "#f5dca6", "#b8c5ed"];
const spinDuration = 7000;

export function WheelOfFortune() {
  const { t } = useLanguage();
  const [initial] = useState(() => {
    const defaults: WheelState = {
      entries: [1, 2, 3, 4].map((number) => t("Option {number}", { number })).join("\n"),
      selectedIndex: null,
      muted: false,
    };
    try {
      const saved = window.localStorage.getItem(WHEEL_STORAGE_KEY);
      if (saved === null) return { state: defaults, error: "" };
      return { state: wheelStateSchema.parse(JSON.parse(saved)), error: "" };
    } catch (error) {
      console.warn("Could not read the saved wheel.", error);
      return { state: defaults, error: "Your saved wheel could not be read." };
    }
  });
  const [state, setState] = useState(initial.state);
  const [error, setError] = useState(initial.error);
  const entries = wheelEntries(state.entries);
  const [rotation, setRotation] = useState(() =>
    initial.state.selectedIndex === null
      ? 0
      : wheelRotationForIndex(
          initial.state.selectedIndex,
          wheelEntries(initial.state.entries).length,
        ),
  );
  const [spinning, setSpinning] = useState(false);
  const [audioError, setAudioError] = useState("");
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const spinInProgress = useRef(false);
  const wheel = useRef<SVGGElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const muted = useRef(initial.state.muted);
  const mounted = useRef(true);
  const audioFailed = useRef(false);
  const lastClick = useRef(-Infinity);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      if (audio.current && audio.current.state !== "closed") {
        void audio.current.close().catch((closeError: unknown) => {
          console.warn("Could not close the wheel audio context.", closeError);
        });
      }
    };
  }, []);

  function save(next: WheelState) {
    setState(next);
    try {
      window.localStorage.setItem(WHEEL_STORAGE_KEY, JSON.stringify(next));
      setError("");
    } catch (saveError) {
      console.warn("Could not save the wheel.", saveError);
      setError("Your wheel could not be saved on this device.");
    }
  }

  function reportAudioError(soundError: unknown) {
    console.warn("Could not play the wheel sound.", soundError);
    audioFailed.current = true;
    if (mounted.current) setAudioError("Could not play the wheel sound.");
  }

  function playClick(context: AudioContext) {
    if (muted.current || audioFailed.current || context.state !== "running") return;
    if (context.currentTime - lastClick.current < 0.05) return;
    try {
      scheduleClick(context, context.currentTime, "sub", false, "tick");
      lastClick.current = context.currentTime;
    } catch (soundError) {
      reportAudioError(soundError);
    }
  }

  async function startAudio(playImmediately = false) {
    audioFailed.current = false;
    setAudioError("");
    try {
      if (!window.AudioContext) throw new Error("AudioContext is unavailable.");
      if (!audio.current || audio.current.state === "closed") {
        audio.current = new AudioContext();
        lastClick.current = -Infinity;
      }
      const context = audio.current;
      await context.resume();
      if (context.state !== "running") throw new Error("AudioContext could not be started.");
      if (playImmediately && mounted.current) playClick(context);
    } catch (soundError) {
      reportAudioError(soundError);
    }
  }

  function followWheel(start: number, count: number) {
    let previousAngle = ((start % 360) + 360) % 360;
    let currentRotation = start;
    let previousBoundary = wheelBoundaryIndex(start, count);
    const update = () => {
      const element = wheel.current;
      if (!element || !spinInProgress.current) return;
      const matrix = new DOMMatrix(window.getComputedStyle(element).transform);
      const angle = ((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI + 360) % 360;
      currentRotation += ((angle - previousAngle + 540) % 360) - 180;
      previousAngle = angle;
      const boundary = wheelBoundaryIndex(currentRotation, count);
      if (boundary !== previousBoundary && audio.current) playClick(audio.current);
      previousBoundary = boundary;
      frame.current = window.requestAnimationFrame(update);
    };
    frame.current = window.requestAnimationFrame(update);
  }

  function spin() {
    if (!entries.length || spinInProgress.current) return;
    spinInProgress.current = true;
    const index = randomWheelIndex(entries.length);
    const nextRotation = nextWheelRotation(rotation, index, entries.length);
    const finish = () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      save({ entries: state.entries, selectedIndex: index, muted: muted.current });
      setSpinning(false);
      spinInProgress.current = false;
      timer.current = null;
    };
    setState({ ...state, selectedIndex: null });
    setRotation(nextRotation);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!muted.current) void startAudio(reducedMotion);
    if (reducedMotion) {
      finish();
    } else {
      setSpinning(true);
      followWheel(rotation, entries.length);
      timer.current = window.setTimeout(finish, spinDuration);
    }
  }

  return (
    <AppPage app="/apps/wheel-of-fortune">
      <div className="space-y-4 sm:space-y-6">
        <section className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("Give the wheel a spin and let it decide.")}
          </p>
          <button
            type="button"
            className="relative w-full max-w-[24rem] rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed"
            aria-label={t("Spin the wheel")}
            disabled={spinning || entries.length === 0}
            onClick={spin}
          >
            <svg
              viewBox="0 0 400 400"
              className="wheel-show block h-auto w-full"
              data-spinning={spinning}
              aria-hidden="true"
            >
              <circle cx="200" cy="200" r="184" fill="#f7c94b" stroke="#d89f37" strokeWidth="5" />
              <g
                ref={wheel}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center",
                  transformBox: "view-box",
                  transition: spinning
                    ? `transform ${spinDuration}ms cubic-bezier(0.12, 0.75, 0.15, 1)`
                    : "none",
                }}
              >
                {entries.length === 0 && <circle cx="200" cy="200" r="168" fill="#eee1ff" />}
                {entries.map((entry, index) => {
                  const angle = (index * 360) / entries.length - 90;
                  const radians = (angle * Math.PI) / 180;
                  const x = 200 + 104 * Math.cos(radians);
                  const y = 200 + 104 * Math.sin(radians);
                  const normalized = ((angle % 360) + 360) % 360;
                  const labelAngle = angle + (normalized > 90 && normalized < 270 ? 180 : 0);
                  const label = entry.length > 18 ? `${entry.slice(0, 17)}…` : entry;
                  return (
                    <g key={index}>
                      <path
                        d={wheelSlicePath(index, entries.length)}
                        fill={colors[index % colors.length]}
                        stroke="#fff5e1"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={y}
                        transform={`rotate(${labelAngle} ${x} ${y})`}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#301348"
                        fontSize={Math.max(5, Math.min(16, 200 / entries.length))}
                        fontWeight="700"
                        fontFamily="var(--font-heading)"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </g>
              {Array.from({ length: 28 }, (_, index) => {
                const angle = (index * 2 * Math.PI) / 28;
                return (
                  <circle
                    key={index}
                    className="wheel-light"
                    cx={200 + 176 * Math.sin(angle)}
                    cy={200 - 176 * Math.cos(angle)}
                    r="4.2"
                    fill="#fff5d9"
                    style={{ animationDelay: `${(index % 4) * -0.3}s` }}
                  />
                );
              })}
              <circle cx="200" cy="200" r="22" fill="#4b1d8b" stroke="#f7c94b" strokeWidth="6" />
              <circle cx="200" cy="200" r="6" fill="#fff5e1" />
              <path
                className="wheel-pointer"
                d="M 184 12 L 216 12 L 200 48 Z"
                fill="#ff6b68"
                stroke="#fff5e1"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={spinning || entries.length === 0}
              onClick={spin}
            >
              <RotateCw aria-hidden="true" />
              {t(spinning ? "Spinning…" : "Spin the wheel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={t(state.muted ? "Unmute wheel sound" : "Mute wheel sound")}
              onClick={() => {
                const nextMuted = !state.muted;
                muted.current = nextMuted;
                save({ ...state, muted: nextMuted });
                if (!nextMuted && spinning) void startAudio();
              }}
            >
              {state.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              {t(state.muted ? "Unmute" : "Mute")}
            </Button>
          </div>
          {audioError && (
            <p role="alert" className="text-sm text-destructive">
              {t(audioError)}
            </p>
          )}
          <p aria-live="polite" className="min-h-7 text-lg font-bold text-primary">
            {spinning ? (
              t("And the wheel chooses…")
            ) : state.selectedIndex !== null ? (
              <span className="wheel-result inline-block">
                {t("The wheel chose: {entry}", { entry: entries[state.selectedIndex] })}
              </span>
            ) : entries.length === 0 ? (
              t("Add at least one option to spin the wheel.")
            ) : (
              ""
            )}
          </p>
        </section>
        <section className="mx-auto w-full max-w-2xl space-y-3">
          <label htmlFor="wheel-entries" className="section-title block font-semibold">
            {t("Wheel entries")}
          </label>
          <p id="wheel-entries-description" className="text-sm text-muted-foreground">
            {t("Enter one option per line. Each line has an equal chance.")}
          </p>
          <Textarea
            id="wheel-entries"
            aria-describedby="wheel-entries-description"
            rows={5}
            disabled={spinning}
            value={state.entries}
            onChange={(event) => {
              save({ entries: event.target.value, selectedIndex: null, muted: state.muted });
              setRotation(0);
            }}
          />
          {!error && (
            <p className="text-xs text-muted-foreground">
              {t("Your wheel is saved on this device.")}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(error)}
            </p>
          )}
        </section>
      </div>
    </AppPage>
  );
}
