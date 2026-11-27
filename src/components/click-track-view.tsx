import { useMemo } from "react";
import { useLanguage } from "../lib/language";
import { expandBars, type BarPlan, type ClickTrack } from "../lib/click-track";

const BAR_WIDTH_REM = 11;

const ramping = (plan?: BarPlan) => !!plan && Math.abs(plan.endBpm - plan.startBpm) > 0.01;

type Mark = {
  showSignature: boolean;
  tempo: number | null;
  rampTarget: number | null;
  direction: "accel." | "rit." | null;
};

function marksFor(plans: BarPlan[]): Mark[] {
  return plans.map((plan, index) => {
    const previous = plans[index - 1];
    const sameSignature = previous && previous.beats === plan.beats && previous.unit === plan.unit;
    const startsRamp = ramping(plan) && !ramping(previous);
    let rampTarget: number | null = null;
    if (startsRamp) {
      let last = index;
      while (ramping(plans[last + 1])) last++;
      rampTarget = plans[last].endBpm;
    }
    const settles = ramping(previous) && !ramping(plan);
    const tempoChanged = !previous || settles || Math.abs(plan.startBpm - previous.endBpm) > 0.01;
    return {
      showSignature: !sameSignature,
      tempo: tempoChanged || startsRamp ? plan.startBpm : null,
      rampTarget,
      direction: ramping(plan) ? (plan.endBpm > plan.startBpm ? "accel." : "rit.") : null,
    };
  });
}

function Fermata() {
  return (
    <svg viewBox="0 0 24 14" className="h-3.5 w-6 text-coral-foreground" aria-hidden="true">
      <path
        d="M2 12a10 10 0 0 1 20 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="10" r="1.8" fill="currentColor" />
    </svg>
  );
}

function BarCard({
  plan,
  mark,
  state,
  beat,
  last,
}: {
  plan: BarPlan;
  mark: Mark;
  state: "past" | "current" | "next";
  beat: number;
  last: boolean;
}) {
  const { t } = useLanguage();
  return (
    <li
      className={`relative flex h-48 shrink-0 flex-col justify-between border-l-2 border-foreground/40 px-3 py-3 transition-opacity duration-300 ${
        last ? "border-r-[5px] border-r-foreground/60" : ""
      } ${state === "current" ? "bg-card/80 opacity-100" : state === "past" ? "opacity-35" : "opacity-75"}`}
      style={{ width: `${BAR_WIDTH_REM}rem` }}
      aria-current={state === "current" ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {plan.bar === 0 ? t("Count-in") : plan.bar}
        </span>
        {mark.showSignature && (
          <span
            className="font-serif text-3xl font-black leading-[0.85] text-primary"
            aria-label={`${plan.beats}/${plan.unit}`}
          >
            <span className="block text-center">{plan.beats}</span>
            <span className="block text-center">{plan.unit}</span>
          </span>
        )}
      </div>
      <div className="min-h-10 font-serif italic text-foreground">
        {mark.tempo !== null && (
          <p className="text-base font-bold not-italic">
            <span aria-hidden="true">♩</span> = {Math.round(mark.tempo)}
            {mark.rampTarget !== null && ` → ${Math.round(mark.rampTarget)}`}
          </p>
        )}
        {mark.direction && (
          <p className="text-sm">
            {t(mark.direction)}{" "}
            <span className="text-muted-foreground" aria-hidden="true">
              ――――›
            </span>
          </p>
        )}
      </div>
      <div className="flex items-end gap-1" aria-hidden="true">
        {Array.from({ length: plan.beats }, (_, index) => {
          const active = state === "current" && beat === index;
          return (
            <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
              {plan.holds?.[index] !== undefined && <Fermata />}
              <span
                className={`w-1.5 rounded-full transition-all duration-100 ${
                  index === 0 ? "h-9" : "h-5"
                } ${active ? "scale-x-150 bg-coral" : "bg-foreground/35"}`}
              />
            </div>
          );
        })}
      </div>
    </li>
  );
}

export function ClickTrackView({
  track,
  index,
  beat,
}: {
  track: ClickTrack;
  index: number;
  beat: number;
}) {
  const plans = useMemo(() => expandBars(track), [track]);
  const marks = useMemo(() => marksFor(plans), [plans]);
  return (
    <div
      className="relative h-48 overflow-hidden rounded-2xl border bg-secondary/40 [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
      aria-hidden="true"
    >
      <ol
        className="absolute top-0 left-1/2 flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(${-(index + 0.5) * BAR_WIDTH_REM}rem)` }}
      >
        {plans.map((plan, planIndex) => (
          <BarCard
            key={planIndex}
            plan={plan}
            mark={marks[planIndex]}
            state={planIndex < index ? "past" : planIndex === index ? "current" : "next"}
            beat={beat}
            last={planIndex === plans.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}
