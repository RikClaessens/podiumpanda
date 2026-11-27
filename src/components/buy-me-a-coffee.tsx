import { useState, type MouseEvent } from "react";
import { CakeSlice, Coffee, Croissant, HandHeart, Heart, type LucideIcon } from "lucide-react";
import { useLanguage } from "../lib/language";
import {
  coffeeAvailable,
  coffeeLinks,
  coffeePresets,
  formatCents,
  type CoffeeChoice,
  type CoffeePresetId,
} from "../lib/coffee";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const presetDetails = {
  espresso: { icon: Coffee, name: "Espresso", tagline: "Quick pick-me-up" },
  coffeeAndCroissant: { icon: Croissant, name: "Coffee and croissant", tagline: "Crumbs included" },
  coffeeAndCake: { icon: CakeSlice, name: "Coffee and cake", tagline: "Pure panda bliss" },
} satisfies Record<CoffeePresetId, { icon: LucideIcon; name: string; tagline: string }>;

const reactions = {
  espresso: "The panda is wide awake and conducting at double tempo!",
  coffeeAndCroissant: "The panda is covered in crumbs and could not be happier.",
  coffeeAndCake: "Cake too?! The panda is doing a happy dance on the podium.",
  custom: "The panda is speechless. Thank you so much!",
} satisfies Record<CoffeeChoice, string>;

const choices: CoffeeChoice[] = [...coffeePresets.map((preset) => preset.id), "custom"];

function TreatThePanda({ iconSize, animate = false }: { iconSize: number; animate?: boolean }) {
  const { t } = useLanguage();
  return (
    <>
      <span className="sr-only">{t("Treat the panda to a coffee")}</span>
      <span aria-hidden="true">
        {t("Treat the panda to a")}{" "}
        <Coffee
          size={iconSize}
          strokeWidth={2.4}
          className={`inline-block align-[-0.15em] ${animate ? "footer-coffee-cup" : ""}`}
        />
      </span>
    </>
  );
}

export function BuyMeACoffee() {
  const { t, locale } = useLanguage();
  const [chosen, setChosen] = useState<CoffeeChoice | null>(null);
  const [missingLink, setMissingLink] = useState(false);
  if (!choices.some(coffeeAvailable)) return null;

  const linkProps = (choice: CoffeeChoice) => ({
    href: coffeeLinks[choice] || undefined,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: (event: MouseEvent) => {
      setChosen(choice);
      setMissingLink(!coffeeLinks[choice]);
      if (!coffeeLinks[choice]) event.preventDefault();
    },
  });

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) return;
        setChosen(null);
        setMissingLink(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground/80 transition-colors hover:text-coral-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <TreatThePanda iconSize={14} animate />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={10}
        className="w-80 overflow-hidden rounded-[1.5rem] border-2 border-coral/70 p-0 shadow-2xl shadow-coral/25"
      >
        <div className="coffee-gradient relative flex items-center gap-4 px-5 py-4">
          <div className="relative shrink-0">
            <img
              key={chosen ?? "idle"}
              src="/podiumpanda.svg"
              alt=""
              width={64}
              height={64}
              className={`size-16 rounded-full bg-cream p-1 shadow-md ${chosen ? "success-pop" : ""}`}
            />
            <span className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-cream bg-coral text-white shadow">
              <Coffee size={14} strokeWidth={2.5} aria-hidden="true" />
            </span>
            {chosen && (
              <>
                <Heart
                  size={16}
                  className="loading-note absolute -top-2 -left-1 fill-coral text-coral"
                  aria-hidden="true"
                />
                <Heart
                  size={12}
                  className="loading-note loading-note-right absolute -top-1 right-0 fill-coral text-coral"
                  aria-hidden="true"
                />
              </>
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-xl leading-tight font-bold">
              <TreatThePanda iconSize={20} />
            </h2>
            {/* All messages share one grid cell, so the tallest reserves the height. */}
            <p className="grid text-sm leading-snug text-foreground/80" aria-live="polite">
              {([null, ...choices] as (CoffeeChoice | null)[]).map((choice) => (
                <span
                  key={choice ?? "idle"}
                  className={`col-start-1 row-start-1 ${choice === chosen ? "" : "invisible"}`}
                >
                  {choice
                    ? t(reactions[choice])
                    : t("Conducting all day is thirsty work. A coffee makes the panda very happy.")}
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {coffeePresets
              .filter(({ id }) => coffeeAvailable(id))
              .map((preset) => {
                const details = presetDetails[preset.id];
                const Icon = details.icon;
                return (
                  <a
                    key={preset.id}
                    {...linkProps(preset.id)}
                    aria-label={`${t(details.name)}, ${formatCents(preset.cents, locale)}`}
                    className={`group flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-center transition-all hover:-translate-y-0.5 hover:border-coral/70 hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${chosen === preset.id ? "border-coral bg-coral/10" : "border-border"}`}
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-coral/15 text-coral-foreground transition-transform group-hover:-rotate-12">
                      <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <span className="text-xs leading-tight font-semibold">{t(details.name)}</span>
                    <span className="text-[0.65rem] leading-tight text-muted-foreground">
                      {t(details.tagline)}
                    </span>
                    <span className="mt-auto text-sm font-bold text-primary">
                      {formatCents(preset.cents, locale)}
                    </span>
                  </a>
                );
              })}
          </div>
          {coffeeAvailable("custom") && (
            <a
              {...linkProps("custom")}
              className={`group flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-coral/70 hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${chosen === "custom" ? "border-coral bg-coral/10" : "border-border"}`}
            >
              <HandHeart
                size={18}
                className="text-coral-foreground transition-transform group-hover:-rotate-12"
                aria-hidden="true"
              />
              {t("Choose your own amount")}
            </a>
          )}
          <p
            className={`text-xs ${missingLink ? "text-destructive" : "text-muted-foreground"}`}
            aria-live="polite"
          >
            {missingLink
              ? t("The coffee payment link is not set up yet.")
              : t("Payments are handled securely by Mollie.")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
