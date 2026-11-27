import { useLanguage } from "../lib/language";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, RefreshCw, Undo2 } from "lucide-react";
import { z } from "zod";
import { ofKind, type Edit } from "../../shared/model";
import { formatUiDate, formatUiTimestamp } from "../../shared/dates";
import { ApiError, editConcert, getConcert, getHistory, undoConcert } from "../lib/api";
import { groupSharingLink, readKey, remember, sharingLink } from "../lib/local";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Picker } from "../components/picker";
import { PandaLoading } from "../components/panda-loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Allocation, ConcertSettings, Players, Preferences, Setlist } from "../components/editors";
const Floorplans = lazy(() => import("../components/floorplans"));
const concertTabSchema = z.enum([
  "setlist",
  "players",
  "preferences",
  "assignments",
  "floorplans",
  "details",
  "history",
]);
export const Route = createFileRoute("/c/$concertId")({
  component: ConcertPage,
  ssr: false,
  validateSearch: z.object({ tab: concertTabSchema.optional().catch(undefined) }),
});
function ConcertPage() {
  const { concertId } = Route.useParams();
  return <ConcertEditor key={concertId} concertId={concertId} />;
}
function ConcertEditor({ concertId }: { concertId: string }) {
  const { t, dynamic } = useLanguage();
  const [initial] = useState(() => {
    try {
      return {
        key: readKey(concertId),
        player: localStorage.getItem(`podiumpanda.me.${concertId}`) ?? "",
        error: "",
      };
    } catch {
      return {
        key: new URLSearchParams(window.location.hash.slice(1)).get("key"),
        player: "",
        error: "Browser storage is unavailable. Keep the full sharing link to reopen this concert.",
      };
    }
  });
  const [key, setKey] = useState<string | null>(initial.key);
  const [message, setMessage] = useState(initial.error);
  const [selectedPlayer, setSelectedPlayer] = useState(initial.player);
  const [copied, setCopied] = useState(false);
  const { tab = "setlist" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tabsList = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const queryKey = ["concert", concertId, key];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const next = await getConcert(concertId, key!);
      const current = queryClient.getQueryData<typeof next>(queryKey);
      return current && current.concert.revision > next.concert.revision ? current : next;
    },
    enabled: !!key && z.uuid().safeParse(concertId).success,
    refetchInterval: (query) =>
      query.state.error
        ? Math.min(30000, 2000 * 2 ** Math.min(query.state.fetchFailureCount + 1, 4))
        : 2000,
    refetchIntervalInBackground: false,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
  const snapshot = query.data;
  const hasSnapshot = !!snapshot;
  useEffect(() => {
    if (!hasSnapshot) return;
    let active = true;
    function showSelectedTab() {
      const list = tabsList.current;
      const selected = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!active || !list || !selected) return;
      const listBounds = list.getBoundingClientRect();
      const tabBounds = selected.getBoundingClientRect();
      if (tabBounds.left < listBounds.left) list.scrollLeft += tabBounds.left - listBounds.left;
      else if (tabBounds.right > listBounds.right)
        list.scrollLeft += tabBounds.right - listBounds.right;
    }
    showSelectedTab();
    void document.fonts.ready.then(showSelectedTab);
    return () => {
      active = false;
    };
  }, [hasSnapshot, tab]);
  const concertTitle = snapshot?.concert.title;
  const groupId = snapshot?.concert.groupId;
  useEffect(() => {
    if (!concertTitle || !key || groupId) return;
    try {
      remember({
        id: concertId,
        key,
        title: concertTitle,
        visitedAt: new Date().toISOString(),
      });
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect -- Report a failed external browser-storage write.
      setMessage("Could not save your shortcut in this browser. Keep a copy of the sharing link.");
    }
  }, [concertTitle, key, concertId, groupId]);
  const mutation = useMutation({
    mutationFn: async ({ edit, revision }: { edit: Edit; revision?: number }) => {
      if (!snapshot || !key) throw new Error("The concert has not loaded yet.");
      await queryClient.cancelQueries({ queryKey });
      return editConcert(
        concertId,
        key,
        {
          ...snapshot,
          concert: { ...snapshot.concert, revision: revision ?? snapshot.concert.revision },
        },
        edit,
      );
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ["history", concertId] });
    },
    onError: (error) => {
      setMessage(error.message);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const undo = useMutation({
    mutationFn: async () => {
      if (!key || !snapshot) throw new Error("The concert has not loaded yet.");
      await queryClient.cancelQueries({ queryKey });
      return undoConcert(concertId, key, snapshot.concert.revision);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ["history", concertId] });
    },
    onError: (error) => {
      setMessage(error.message);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const history = useQuery({
    queryKey: ["history", concertId, key],
    queryFn: () => getHistory(concertId, key!),
    enabled: !!key && tab === "history",
    refetchInterval: tab === "history" ? 2000 : false,
  });
  async function onEdit(edit: Edit, revision?: number) {
    if (mutation.isPending || undo.isPending) return false;
    setMessage("");
    try {
      await mutation.mutateAsync({ edit, revision });
      return true;
    } catch {
      return false;
    } // The mutation's onError displays the failure and reloads shared state.
  }
  if (!z.uuid().safeParse(concertId).success)
    return (
      <main className="p-8 text-center" role="alert">
        {t("This concert link is invalid.")}
      </main>
    );
  if (!key)
    return (
      <main className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="section-title">{t("Open with the full sharing link")}</h1>
        <p>
          {t(
            "This address is missing its sharing key. Ask your group for the full link, including the portion after #.",
          )}
        </p>
        {message && <p role="alert">{dynamic(message)}</p>}
        <form
          className="flex flex-col items-start gap-2 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const raw = data.get("key");
            if (typeof raw === "string") setKey(raw.trim());
          }}
        >
          <Input
            name="key"
            aria-label={t("Sharing key")}
            placeholder={t("Paste sharing key")}
            required
          />
          <Button>{t("Open")}</Button>
        </form>
      </main>
    );
  if (!snapshot)
    return (
      <main className="mx-auto max-w-xl space-y-4 p-8">
        {query.error ? (
          <>
            <h1 className="section-title">{t("Could not open concert")}</h1>
            <p role="alert">{dynamic(query.error.message)}</p>
            <Button onClick={() => query.refetch()}>{t("Try again")}</Button>
          </>
        ) : (
          <PandaLoading label={t("Loading your concert\u2026")} />
        )}
      </main>
    );
  const busy = mutation.isPending || undo.isPending;
  const props = { snapshot, busy, onEdit };
  const players = ofKind(snapshot, "player");
  return (
    <main className="page-enter mx-auto max-w-7xl space-y-6 px-5 py-7">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-full">
          {groupId && (
            <Link
              className="text-sm text-primary hover:underline"
              to="/g/$groupId"
              params={{ groupId }}
              hash={`key=${key}`}
            >
              {t("← Back to group")}
            </Link>
          )}
          <p className="eyebrow">{t("Concert workspace")}</p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">
            {snapshot.concert.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot.concert.date ? formatUiDate(snapshot.concert.date) : t("Date to be decided")}{" "}
            · {players.length} {t("players")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="field min-w-0 max-w-full">
            <label htmlFor="selected-player">{t("I\u2019m playing as")}</label>
            <Picker
              id="selected-player"
              className="min-w-44 max-w-full"
              value={players.some((player) => player.id === selectedPlayer) ? selectedPlayer : ""}
              onValueChange={(value) => {
                setSelectedPlayer(value);
                try {
                  localStorage.setItem(`podiumpanda.me.${concertId}`, value);
                } catch {
                  setMessage("Your player selection could not be remembered on this device.");
                }
              }}
              options={[
                { value: "", label: t("Choose your name") },
                ...players.map((player) => ({ value: player.id, label: player.name })),
              ]}
            />
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  groupId ? groupSharingLink(groupId, key) : sharingLink(concertId, key),
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setMessage(
                  `Could not copy automatically. Your sharing link: ${groupId ? groupSharingLink(groupId, key) : sharingLink(concertId, key)}`,
                );
              }
            }}
          >
            {copied ? <Check size={16} className="success-pop" /> : <Copy size={16} />}
            {copied ? t("Copied") : groupId ? t("Share group") : t("Share concert")}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => query.refetch()}>
            <RefreshCw size={16} />
            {t("Refresh")}
          </Button>
          {(busy || query.error) && (
            <output className="text-xs text-muted-foreground">
              {busy ? t("Saving\u2026") : t("Updates disconnected. Your view may be out of date.")}
            </output>
          )}
        </div>
      </section>
      {(message || query.error) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm break-words text-destructive"
        >
          {dynamic(message || query.error?.message || "")}
          {message && (
            <Button size="sm" variant="ghost" onClick={() => setMessage("")}>
              {t("Dismiss")}
            </Button>
          )}
        </div>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({
            search: (previous) => ({ ...previous, tab: concertTabSchema.parse(value) }),
            hash: true,
            resetScroll: false,
          })
        }
      >
        <p className="text-xs text-muted-foreground md:hidden">
          {t("Swipe to see more sections →")}
        </p>
        <TabsList
          ref={tabsList}
          aria-label={t("Concert sections")}
          className="mb-5 flex max-w-full justify-start overflow-x-auto overscroll-x-contain"
        >
          <TabsTrigger value="setlist">{t("Setlist")}</TabsTrigger>
          <TabsTrigger value="players">{t("Players")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("Preferences")}</TabsTrigger>
          <TabsTrigger value="assignments">{t("Assignments")}</TabsTrigger>
          <TabsTrigger value="floorplans">{t("Floorplans")}</TabsTrigger>
          <TabsTrigger value="details">{t("Details")}</TabsTrigger>
          <TabsTrigger value="history">{t("History")}</TabsTrigger>
        </TabsList>
        <TabsContent value="setlist">
          <Setlist {...props} selectedPlayer={selectedPlayer} />
        </TabsContent>
        <TabsContent value="players">
          <Players {...props} />
        </TabsContent>
        <TabsContent value="preferences">
          <Preferences {...props} selectedPlayer={selectedPlayer} />
        </TabsContent>
        <TabsContent value="assignments">
          <Allocation {...props} selectedPlayer={selectedPlayer} />
        </TabsContent>
        <TabsContent value="floorplans">
          <Suspense fallback={<PandaLoading label={t("Loading floorplan editor\u2026")} />}>
            <Floorplans {...props} />
          </Suspense>
        </TabsContent>
        <TabsContent value="details">
          <ConcertSettings {...props} />
        </TabsContent>
        <TabsContent value="history">
          <section className="panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">{t("Recent changes")}</h2>
              <Button
                variant="outline"
                disabled={busy || snapshot.concert.revision === 0}
                onClick={() => {
                  setMessage("");
                  undo.mutate();
                }}
              >
                <Undo2 size={16} />
                {t("Undo last edit")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                "Undo restores the most recent shared edit, including deleted items. Names aren\u2019t verified, so edits aren\u2019t attributed to people.",
              )}
            </p>
            {history.error && (
              <p role="alert" className="text-destructive">
                {dynamic(history.error.message)}
              </p>
            )}
            {history.isPending ? (
              <PandaLoading label={t("Loading history\u2026")} />
            ) : (
              <ul className="divide-y">
                {history.data?.map((item) => (
                  <li
                    key={item.revision}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      #{item.revision} · {dynamic(item.description)}
                    </span>
                    <span className="text-muted-foreground">{formatUiTimestamp(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
