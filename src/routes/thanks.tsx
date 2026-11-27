import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CakeSlice,
  Coffee,
  Croissant,
  Heart,
  Music2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useLanguage } from "../lib/language";

export const Route = createFileRoute("/thanks")({ component: Thanks });

const particles: { icon: LucideIcon; left: string; size: number; delay: string; color: string }[] =
  [
    { icon: Coffee, left: "6%", size: 22, delay: "0ms", color: "text-coral-foreground" },
    { icon: Heart, left: "22%", size: 16, delay: "-2600ms", color: "fill-coral text-coral" },
    { icon: Music2, left: "38%", size: 20, delay: "-1400ms", color: "text-primary" },
    { icon: Croissant, left: "62%", size: 20, delay: "-3400ms", color: "text-coral-foreground" },
    { icon: Heart, left: "78%", size: 14, delay: "-700ms", color: "fill-coral text-coral" },
    { icon: CakeSlice, left: "90%", size: 18, delay: "-2000ms", color: "text-primary" },
  ];

function Thanks() {
  const { t } = useLanguage();
  return (
    <main className="page-enter mx-auto max-w-5xl px-5 py-10">
      <section className="coffee-gradient grid grid-cols-[minmax(0,1fr)] items-center gap-8 overflow-hidden rounded-[1.75rem] border-2 border-coral/70 p-7 shadow-2xl shadow-coral/25 sm:grid-cols-[1.2fr_1fr] sm:p-10">
        <div className="space-y-5">
          <p className="eyebrow flex items-center gap-2">
            <Coffee size={14} aria-hidden="true" />
            {t("Order up!")}
          </p>
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-primary xl:text-5xl">
            {t("Thank you!")}
            <br />
            {t("The panda is buzzing.")}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-foreground/80">
            {t(
              "Your coffee just arrived on the podium. The panda took one sip and is now conducting at double tempo.",
            )}
          </p>
          <p className="max-w-lg text-base leading-relaxed text-foreground/80">
            {t("Thanks for keeping PodiumPanda free for every group and orchestra.")}
          </p>
          <Button asChild size="lg">
            <Link to="/">
              {t("Back to the music")}
              <ArrowRight className="button-arrow" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="relative mx-auto w-56 max-w-full sm:w-full sm:max-w-80" aria-hidden="true">
          {particles.map(({ icon: Icon, left, size, delay, color }, index) => (
            <Icon
              key={index}
              size={size}
              className={`treat-particle ${color}`}
              style={{ left, animationDelay: delay }}
            />
          ))}
          <Music2 size={26} className="loading-note" style={{ top: "20%", left: "2%" }} />
          <Heart
            size={22}
            className="loading-note loading-note-right fill-coral text-coral"
            style={{ top: "8%", right: "4%" }}
          />
          <img
            src="/podiumpanda-full.png"
            alt=""
            width={764}
            height={854}
            className="panda-illustration relative w-full drop-shadow-lg"
          />
          <span className="coffee-cup -right-[2%] bottom-[30%] grid size-14 place-items-center rounded-full border-4 border-cream bg-coral text-white shadow-lg sm:size-16">
            <span className="coffee-steam text-foreground/60">
              <span />
              <span />
              <span />
            </span>
            <Coffee size={28} strokeWidth={2.4} />
          </span>
        </div>
      </section>
    </main>
  );
}
