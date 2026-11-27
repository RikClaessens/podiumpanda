import { Link } from "@tanstack/react-router";
import { AppIcon } from "./app-icon";
import { useLanguage } from "../lib/language";
import type { apps } from "../lib/apps";

type AppDefinition = (typeof apps)[number];

export function AppCard({ app }: { app: AppDefinition }) {
  const { t } = useLanguage();
  return (
    <Link
      to={app.to}
      aria-label={t(app.name)}
      className="app-card concert-card group flex min-h-44 flex-col justify-between gap-6 rounded-2xl border border-l-4 border-l-coral bg-secondary/60 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="block h-16 w-16 overflow-hidden text-primary">
        <AppIcon app={app.to} />
      </span>
      <span className="block text-2xl font-semibold leading-tight">{t(app.name)}</span>
    </Link>
  );
}
