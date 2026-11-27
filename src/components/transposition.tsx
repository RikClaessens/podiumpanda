import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useLanguage } from "../lib/language";
import { instruments, isInstrumentId, type InstrumentId } from "../lib/tuner";
import { formatNote, transposeByOffsets } from "../lib/transposition";
import { AppPage } from "./app-page";
import { Picker } from "./picker";
import { Button } from "./ui/button";

const naturalBars = [
  { pitch: 0, name: "C" },
  { pitch: 2, name: "D" },
  { pitch: 4, name: "E" },
  { pitch: 5, name: "F" },
  { pitch: 7, name: "G" },
  { pitch: 9, name: "A" },
  { pitch: 11, name: "B" },
] as const;
const accidentalBars = [
  { pitch: 1, name: "C♯", boundary: 1 },
  { pitch: 3, name: "D♯", boundary: 2 },
  { pitch: 6, name: "F♯", boundary: 4 },
  { pitch: 8, name: "G♯", boundary: 5 },
  { pitch: 10, name: "A♯", boundary: 6 },
] as const;

type InstrumentSelection = InstrumentId | "custom";

function CustomInterval({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-3 rounded-xl border bg-card/80 p-3">
      <p className="text-xs font-semibold">{t("Written pitch relative to concert pitch")}</p>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("Decrease transposition for {instrument}", { instrument: label })}
          disabled={value <= -48}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} />
        </Button>
        <span className="min-w-24 text-center text-sm tabular-nums">
          {value > 0 ? "+" : ""}
          {value} {t(Math.abs(value) === 1 ? "semitone" : "semitones")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("Increase transposition for {instrument}", { instrument: label })}
          disabled={value >= 48}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}

export function Transposition() {
  const { t } = useLanguage();
  const [from, setFrom] = useState<InstrumentSelection>("concert");
  const [to, setTo] = useState<InstrumentSelection>("bb");
  const [fromOffset, setFromOffset] = useState(0);
  const [toOffset, setToOffset] = useState(0);
  const [octave, setOctave] = useState(4);
  const [pitch, setPitch] = useState(0);
  const written = (octave + 1) * 12 + pitch;
  const offset = (instrument: InstrumentSelection, custom: number) =>
    instrument === "custom"
      ? custom
      : instruments.find((item) => item.id === instrument)!.semitones;
  const { concert, result } = transposeByOffsets(
    written,
    offset(from, fromOffset),
    offset(to, toOffset),
  );
  const options = [
    ...instruments.map((instrument) => ({
      value: instrument.id,
      label: t(instrument.label),
    })),
    { value: "custom", label: t("Other instrument…") },
  ];

  return (
    <AppPage app="/apps/transposition">
      <section className="relative">
        <div className="relative z-10 space-y-6">
          <div className="rounded-2xl border bg-card/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{t("Choose the written note")}</h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("Lower octave")}
                  disabled={octave <= -1}
                  onClick={() => setOctave(octave - 1)}
                >
                  <Minus size={18} />
                </Button>
                <span className="min-w-20 text-center text-sm font-semibold tabular-nums">
                  {t("Octave {octave}", { octave })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("Higher octave")}
                  disabled={octave >= 9}
                  onClick={() => setOctave(octave + 1)}
                >
                  <Plus size={18} />
                </Button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="relative mx-auto flex h-44 min-w-[25rem] max-w-xl items-end gap-1 sm:h-52 sm:gap-2">
                {naturalBars.map((bar, index) => (
                  <button
                    key={bar.pitch}
                    type="button"
                    aria-label={formatNote((octave + 1) * 12 + bar.pitch)}
                    aria-pressed={pitch === bar.pitch}
                    onClick={() => setPitch(bar.pitch)}
                    className={`relative flex min-w-0 flex-1 items-end justify-center rounded-lg border-b-4 pb-3 font-heading font-bold shadow-sm transition-colors focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      pitch === bar.pitch
                        ? "border-coral-foreground bg-coral text-foreground dark:text-primary-foreground"
                        : "border-primary/25 bg-secondary text-foreground hover:bg-lavender/30"
                    }`}
                    style={{ height: `${100 - index * 3}%` }}
                  >
                    {bar.name}
                    <span className="ml-0.5 text-xs">{octave}</span>
                  </button>
                ))}
                {accidentalBars.map((bar) => (
                  <button
                    key={bar.pitch}
                    type="button"
                    aria-label={formatNote((octave + 1) * 12 + bar.pitch)}
                    aria-pressed={pitch === bar.pitch}
                    onClick={() => setPitch(bar.pitch)}
                    className={`absolute top-0 z-10 flex h-[48%] w-[11%] -translate-x-1/2 items-end justify-center rounded-lg border-b-4 pb-2 text-xs font-bold shadow-md transition-colors focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm ${
                      pitch === bar.pitch
                        ? "border-coral-foreground bg-coral text-foreground dark:text-primary-foreground"
                        : "border-primary bg-primary/90 text-primary-foreground hover:bg-primary"
                    }`}
                    style={{ left: `${(bar.boundary / 7) * 100}%` }}
                  >
                    {bar.name}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
              {t("Swipe to see all notes →")}
            </p>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("Sharps and flats on the same bar sound alike.")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="transpose-from" className="mb-2 block font-semibold">
                {t("From instrument")}
              </label>
              <Picker
                id="transpose-from"
                value={from}
                className="w-full"
                contentPosition="popper"
                contentClassName="max-h-[min(18rem,var(--radix-select-content-available-height))]"
                options={options}
                onValueChange={(value) => {
                  if (isInstrumentId(value) || value === "custom") setFrom(value);
                }}
              />
              {from === "custom" && (
                <CustomInterval
                  label={t("From instrument")}
                  value={fromOffset}
                  onChange={setFromOffset}
                />
              )}
            </div>
            <div>
              <label htmlFor="transpose-to" className="mb-2 block font-semibold">
                {t("To instrument")}
              </label>
              <Picker
                id="transpose-to"
                value={to}
                className="w-full"
                contentPosition="popper"
                contentClassName="max-h-[min(18rem,var(--radix-select-content-available-height))]"
                options={options}
                onValueChange={(value) => {
                  if (isInstrumentId(value) || value === "custom") setTo(value);
                }}
              />
              {to === "custom" && (
                <CustomInterval
                  label={t("To instrument")}
                  value={toOffset}
                  onChange={setToOffset}
                />
              )}
            </div>
          </div>

          <div aria-live="polite" className="grid gap-3 text-center sm:grid-cols-2">
            <div className="rounded-2xl border bg-card/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("From note")}
              </p>
              <p className="mt-1 font-heading text-3xl font-bold text-primary">
                {formatNote(written)}
              </p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-secondary/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("To note")}
              </p>
              <p className="mt-1 font-heading text-3xl font-bold text-primary">
                {formatNote(result)}
              </p>
            </div>
            {from !== "concert" && to !== "concert" && (
              <div className="rounded-2xl border bg-card/80 p-4 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Concert pitch (C)")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold text-primary">
                  {formatNote(concert)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppPage>
  );
}
