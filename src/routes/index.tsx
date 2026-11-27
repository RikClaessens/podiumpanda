import { useLanguage } from "../lib/language";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, LayoutDashboard, ListMusic, Music2, Plus, Users, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { GroupIcon } from "../components/group-icon";
import { forget, recents, recentGroups, type Recent } from "../lib/local";
import { apps } from "../lib/apps";
import { AppCard } from "../components/app-card";
export const Route = createFileRoute("/")({ component: Home, ssr: false });
function Home() {
  return <HomeContent />;
}
function HomeContent() {
  const { t, dynamic } = useLanguage();
  const [initial] = useState(() => {
    try {
      return { recent: recents(), groups: recentGroups(), error: "" };
    } catch (error) {
      return {
        recent: [],
        groups: [],
        error: error instanceof Error ? error.message : "Browser storage is unavailable.",
      };
    }
  });
  const [recent, setRecent] = useState<Recent[]>(initial.recent);
  const groups = initial.groups;
  const [error, setError] = useState(initial.error);
  return (
    <main className="page-enter mx-auto max-w-7xl space-y-10 px-5 py-10">
      <section className="hero-panel grid grid-cols-[minmax(0,1fr)] items-center gap-5 sm:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <p className="eyebrow">{t("A little harmony before the concert")}</p>
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-primary xl:text-5xl">
            {t("Your group.")}
            <br />
            {t("Everyone in tune.")}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            {t(
              "Build the setlist, find everyone\u2019s part, and make room on stage. One shared link. No accounts needed.",
            )}
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-foreground">
            <span className="flex items-center gap-2 rounded-full bg-yellow/25 px-3 py-2">
              <ListMusic size={18} />
              {t("Setlists")}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-coral/20 px-3 py-2">
              <Users size={18} />
              {t("Players & parts")}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-lavender/20 px-3 py-2">
              <LayoutDashboard size={18} />
              {t("Floorplans")}
            </span>
          </div>
        </div>
        <div className="panda-hero relative mx-auto w-52 max-w-full sm:w-full sm:max-w-80">
          <Music2 size={26} className="loading-note loading-note-left" aria-hidden="true" />
          <img
            src="/podiumpanda-full.png"
            alt={t("PodiumPanda, a cheerful panda conductor waving a baton")}
            width={764}
            height={854}
            className="panda-illustration w-full drop-shadow-lg"
            fetchPriority="high"
          />
          <Music2 size={22} className="loading-note loading-note-right" aria-hidden="true" />
        </div>
      </section>
      {error && (
        <p role="alert" className="text-destructive">
          {dynamic(error)}
        </p>
      )}
      <section className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <h2 className="section-title">{t("Your recent groups")}</h2>
          {groups.length === 0 ? (
            <div className="panel space-y-4">
              <p className="text-muted-foreground">
                {t("Create a group, or open a group link you received.")}
              </p>
              <Button asChild size="sm">
                <Link to="/g/new">
                  <Plus size={16} />
                  {t("Create group")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {groups.map((item) => (
                <Link
                  key={item.id}
                  to="/g/$groupId"
                  params={{ groupId: item.id }}
                  hash={`key=${item.key}`}
                  className="concert-card panel flex min-h-20 min-w-0 items-center gap-4"
                >
                  <GroupIcon icon={item.icon} className="shrink-0 text-coral-foreground" />
                  <h3 className="min-w-0 text-2xl font-semibold break-words">{item.title}</h3>
                </Link>
              ))}
              <Link
                to="/g/new"
                className="concert-card flex min-h-20 min-w-0 items-center gap-4 rounded-[1.25rem] border-2 border-dashed border-primary/40 bg-secondary/40 p-5 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus size={24} className="shrink-0" aria-hidden="true" />
                <h3 className="text-2xl font-semibold">{t("Create group")}</h3>
              </Link>
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <h2 className="section-title">{t("Apps")}</h2>
          <div className="space-y-3">
            {apps.map((app) => {
              return <AppCard key={app.to} app={app} variant="homepage" />;
            })}
          </div>
        </aside>
      </section>
      {recent.length > 0 && (
        <section className="space-y-4">
          <h2 className="section-title">{t("Earlier concert shortcuts")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("These older concerts remain accessible with their original links.")}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {recent.map((item) => (
              <div
                key={item.id}
                className="concert-card panel relative flex items-start justify-between gap-3"
              >
                <Link
                  to="/c/$concertId"
                  params={{ concertId: item.id }}
                  hash={`key=${item.key}`}
                  className="min-w-0 flex-1 space-y-3 after:absolute after:inset-0 after:rounded-xl"
                >
                  <CalendarDays size={22} className="text-coral-foreground" />
                  <h3 className="font-semibold break-words">{item.title}</h3>
                  <span className="text-xs text-muted-foreground">{t("Open concert \u2192")}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative z-10"
                  aria-label={t("Forget shortcut to {name}", { name: item.title })}
                  onClick={() => {
                    try {
                      forget(item.id);
                      setRecent(recents());
                    } catch {
                      setError("Could not remove the shortcut from browser storage.");
                    }
                  }}
                >
                  <X size={15} />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
