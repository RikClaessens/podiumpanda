import { useMemo, type ReactNode } from "react";
import { useLanguage } from "../lib/language";
import { expandBars, type BarPlan, type ClickTrack } from "../lib/click-track";

const BAR_WIDTH_REM = 11;

const ramping = (plan?: BarPlan) =>
  !!plan && plan.ramp && Math.abs(plan.endBpm - plan.startBpm) > 0.01;

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

// Drawn as SVG because the Unicode musical symbols are missing from most system fonts.
function Coda() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-label="Coda" role="img">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="5" />
        <path d="M10 1v18M1 10h18" />
      </g>
    </svg>
  );
}

function Segno() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-label="Segno" role="img">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M13.5 4.5C12 2 7 3 7 6c0 3.500 6 4 6 8 0 3-5 4-6.500 1.500" />
        <path d="M16 3L4 17" />
      </g>
      <circle cx="4.500" cy="8" r="1.200" fill="currentColor" />
      <circle cx="15.500" cy="12" r="1.200" fill="currentColor" />
    </svg>
  );
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
  const markLabels: Record<string, ReactNode> = {
    segno: <Segno />,
    coda: <Coda />,
    tocoda: (
      <span className="inline-flex items-center gap-1">
        {t("To")} <Coda />
      </span>
    ),
    fine: "Fine",
  };
  const jumpLabel = plan.jump
    ? `${plan.jump.to === "start" ? "D.C." : "D.S."}${
        plan.jump.until === "fine"
          ? ` ${t("al Fine")}`
          : plan.jump.until === "coda"
            ? ` ${t("al Coda")}`
            : ""
      }`
    : null;
  return (
    <li
      className={`relative flex h-52 shrink-0 flex-col justify-between border-l-2 px-3 py-3 transition-opacity duration-300 ${
        plan.repeatStart ? "border-l-[5px] border-l-foreground/70" : "border-foreground/40"
      } ${
        last || plan.repeatEnd ? "border-r-[5px] border-r-foreground/60" : ""
      } ${state === "current" ? "bg-card/80 opacity-100" : state === "past" ? "opacity-35" : "opacity-75"}`}
      style={{ width: `${BAR_WIDTH_REM}rem` }}
      aria-current={state === "current" ? "true" : undefined}
    >
      {plan.ending && (
        <span
          className={`absolute -top-px left-0 right-0 border-t-2 border-foreground/60 pl-1 text-xs font-bold ${
            plan.ending.start ? "border-l-2" : ""
          } ${plan.ending.end ? "border-r-2" : ""}`}
        >
          {plan.ending.start ? `${plan.ending.passes.join(", ")}.` : "\u00a0"}
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {plan.bar === 0 ? t("Count-in") : plan.bar}
          {plan.passes > 1 && (
            <span className="ml-1 rounded bg-coral/20 px-1 normal-case tracking-normal">
              {plan.pass}/{plan.passes}
            </span>
          )}
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
        {(plan.marks?.length || jumpLabel) && (
          <p className="text-sm font-bold not-italic text-primary">
            {[...(plan.marks ?? []).map((kind) => markLabels[kind]), jumpLabel]
              .filter(Boolean)
              .map((label, index) => (
                <span key={index} className="mr-2 inline-flex items-center align-middle">
                  {label}
                </span>
              ))}
          </p>
        )}
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
        {plan.pulses.map((units, index) => {
          const active = state === "current" && beat === index;
          const change = plan.changes?.find((item) => item.pulse === index);
          const height =
            plan.accents[index] === 3
              ? "h-9"
              : plan.accents[index] === 2
                ? "h-7"
                : plan.accents[index] === 0
                  ? "h-2"
                  : "h-5";
          return (
            <div
              key={index}
              className="flex flex-col items-center justify-end gap-1"
              style={{ flex: units }}
            >
              {change && (
                <span className="text-[10px] font-bold not-italic">♩={Math.round(change.bpm)}</span>
              )}
              {plan.caesuras?.includes(index) ? (
                <span className="font-serif text-sm font-black">//</span>
              ) : (
                plan.holds?.[index] !== undefined && <Fermata />
              )}
              <span
                className={`w-1.5 rounded-full transition-all duration-100 ${height} ${
                  active ? "scale-x-150 bg-coral" : "bg-foreground/35"
                }`}
              />
              {plan.sub > 1 && (
                <span className="text-[9px] leading-none text-muted-foreground">
                  {plan.swing && plan.sub === 2 ? "3" : plan.sub}
                </span>
              )}
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
