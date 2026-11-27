import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language";
import type { apps } from "../lib/apps";

type AppDefinition = (typeof apps)[number];

export function AppCard({ app }: { app: AppDefinition }) {
  const { t } = useLanguage();
  const Icon = app.icon;
  return (
    <Link
      to={app.to}
      aria-label={t(app.name)}
      className="app-card concert-card group flex min-h-20 items-center gap-4 rounded-2xl border-l-4 border-y border-r border-l-coral bg-secondary/60 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5"
    >
      <Icon
        size={27}
        strokeWidth={2.2}
        className={`shrink-0 ${app.iconColor}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-semibold leading-tight">{t(app.name)}</span>
      </span>
    </Link>
  );
}
