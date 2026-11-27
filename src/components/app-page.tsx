import type { ReactNode } from "react";
import { Music2, Music3, Music4 } from "lucide-react";
import { apps } from "../lib/apps";
import { useLanguage } from "../lib/language";

type AppPath = (typeof apps)[number]["to"];

export function AppPage({ app: path, children }: { app: AppPath; children: ReactNode }) {
  const { t } = useLanguage();
  const app = apps.find((item) => item.to === path)!;
  const Icon = app.icon;
  return (
    <main className="page-enter mx-auto max-w-3xl px-4 py-3 sm:px-6 sm:py-8">
      <section className="space-y-3 sm:space-y-8">
        <header className="relative min-h-10 pr-28 sm:min-h-12">
          <div
            className="pointer-events-none absolute top-1 right-1 flex items-center gap-1"
            aria-hidden="true"
          >
            <Music2 className="text-primary opacity-[0.12]" size={36} />
            <Music3 className="text-coral-foreground opacity-[0.12]" size={22} />
            <Music4 className="text-yellow opacity-[0.14]" size={20} />
          </div>
          <h1 className="relative flex items-center gap-3 text-3xl font-bold text-primary sm:text-4xl">
            <Icon
              size={34}
              strokeWidth={2.2}
              className={`shrink-0 ${app.iconColor}`}
              aria-hidden="true"
            />
            {t(app.name)}
          </h1>
        </header>
        {children}
      </section>
    </main>
  );
}
