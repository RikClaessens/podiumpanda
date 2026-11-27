import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "../lib/language";
import type { apps } from "../lib/apps";

type AppDefinition = (typeof apps)[number];

export function AppCard({
  app,
  showDescription = false,
}: {
  app: AppDefinition;
  showDescription?: boolean;
}) {
  const { t } = useLanguage();
  const Icon = app.icon;
  return (
    <Link
      to={app.to}
      aria-label={showDescription ? undefined : t(app.name)}
      className="app-card concert-card group flex min-h-20 items-center gap-4 rounded-2xl border-l-4 border-y border-r border-l-coral bg-secondary/60 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5"
    >
      <Icon
        size={27}
        strokeWidth={2.2}
        className={`shrink-0 ${app.iconColor}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{t(app.name)}</span>
        {showDescription && (
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            {t(app.description)}
          </span>
        )}
      </span>
      <ArrowUpRight
        size={18}
        className="shrink-0 text-coral-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
