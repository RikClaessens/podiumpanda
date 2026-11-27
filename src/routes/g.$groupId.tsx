import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { formatUiDate } from "../../shared/dates";
import type { GroupEdit, GroupIcon as GroupIconName, OfKind } from "../../shared/model";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DatePicker } from "../components/date-picker";
import { DeleteButton } from "../components/editors";
import { EditToggle } from "../components/edit-toggle";
import { PandaLoading } from "../components/panda-loading";
import { GroupIcon, GroupIconPicker } from "../components/group-icon";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { createGroupConcert, editGroup, getGroup } from "../lib/api";
import { forgetGroup, groupSharingLink, readGroupKey, rememberGroup } from "../lib/local";
import { useLanguage } from "../lib/language";

export const Route = createFileRoute("/g/$groupId")({ component: GroupPage, ssr: false });

function GroupPage() {
  const { groupId } = Route.useParams();
  return <GroupWorkspace key={groupId} groupId={groupId} />;
}

function GroupWorkspace({ groupId }: { groupId: string }) {
  const { t, dynamic } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initial] = useState(() => {
    try {
      return { key: readGroupKey(groupId), error: "" };
    } catch {
      return {
        key: new URLSearchParams(location.hash.slice(1)).get("key"),
        error: "Browser storage is unavailable. Keep a copy of the group link.",
      };
    }
  });
  const [key, setKey] = useState(initial.key);
  const [message, setMessage] = useState(initial.error);
  const [name, setName] = useState("");
  const [editingPlayers, setEditingPlayers] = useState(false);
  const [addingConcert, setAddingConcert] = useState(false);
  const [concertTitle, setConcertTitle] = useState("");
  const [date, setDate] = useState("");
  const [playerDraft, setPlayerDraft] = useState<{
    player: OfKind<"player">;
    revision: number;
  } | null>(null);
  const [groupDraft, setGroupDraft] = useState<{
    name: string;
    icon: GroupIconName;
    revision: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const queryKey = ["group", groupId, key];
  const query = useQuery({
    queryKey,
    queryFn: () => getGroup(groupId, key!),
    enabled: !!key && z.uuid().safeParse(groupId).success,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const groupName = query.data?.group.name;
  const groupIcon = query.data?.group.icon;
  useEffect(() => {
    if (!groupName || !groupIcon || !key) return;
    try {
      rememberGroup({
        id: groupId,
        key,
        title: groupName,
        icon: groupIcon,
        visitedAt: new Date().toISOString(),
      });
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect -- Report an external storage failure.
      setMessage("Browser storage is unavailable. Keep a copy of the group link.");
    }
  }, [groupId, key, groupName, groupIcon]);
  const update = useMutation({
    mutationFn: async (edit: GroupEdit) => {
      await queryClient.cancelQueries({ queryKey });
      return editGroup(groupId, key!, edit);
    },
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
    onError: (error) => {
      setMessage(error.message);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      await queryClient.cancelQueries({ queryKey });
      return createGroupConcert(groupId, key!, concertTitle, date, t("Main stage"));
    },
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey });
      await navigate({ to: "/c/$concertId", params: { concertId: id }, hash: `key=${key}` });
    },
    onError: (error) => {
      setMessage(error.message);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  async function save(edit: GroupEdit) {
    setMessage("");
    try {
      await update.mutateAsync(edit);
      return true;
    } catch {
      return false;
    }
  }
  if (!z.uuid().safeParse(groupId).success)
    return (
      <main className="p-8" role="alert">
        {t("This group link is invalid.")}
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
        <form
          className="flex flex-col items-start gap-2 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("key");
            if (typeof value === "string") setKey(value.trim());
          }}
        >
          <Input name="key" aria-label={t("Sharing key")} required />
          <Button>{t("Open")}</Button>
        </form>
      </main>
    );
  if (!query.data)
    return (
      <main className="mx-auto max-w-xl p-8">
        {query.error ? (
          <div role="alert">
            <p>{dynamic(query.error.message)}</p>
            <Button onClick={() => query.refetch()}>{t("Try again")}</Button>
          </div>
        ) : (
          <PandaLoading label={t("Loading your group…")} />
        )}
      </main>
    );
  const { group, concerts } = query.data;
  const busy = update.isPending || create.isPending;
  return (
    <main className="page-enter mx-auto max-w-7xl space-y-6 px-5 py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border">
            <GroupIcon icon={group.icon} size={23} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">{t("Group workspace")}</p>
            <h1 className="min-w-0 break-words text-3xl font-bold">{group.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover
            open={!!groupDraft}
            onOpenChange={(open) => {
              if (!busy)
                setGroupDraft(
                  open ? { name: group.name, icon: group.icon, revision: group.revision } : null,
                );
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={busy}>
                <Pencil size={16} />
                {t("Edit group")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2.5rem)] space-y-3">
              {groupDraft && (
                <form
                  className="space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      await save({
                        type: "details",
                        name: groupDraft.name,
                        icon: groupDraft.icon,
                        expectedRevision: groupDraft.revision,
                      })
                    )
                      setGroupDraft(null);
                  }}
                >
                  <div className="field">
                    <label htmlFor="edit-group-name">{t("Group name")}</label>
                    <Input
                      id="edit-group-name"
                      value={groupDraft.name}
                      maxLength={160}
                      required
                      onChange={(event) =>
                        setGroupDraft({ ...groupDraft, name: event.target.value })
                      }
                    />
                  </div>
                  <GroupIconPicker
                    value={groupDraft.icon}
                    onChange={(icon) => setGroupDraft({ ...groupDraft, icon })}
                  />
                  <div className="flex gap-2">
                    <Button disabled={busy}>{t("Save")}</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setGroupDraft(null)}
                    >
                      {t("Cancel")}
                    </Button>
                  </div>
                </form>
              )}
              <div className="space-y-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    try {
                      forgetGroup(groupId);
                    } catch {
                      setMessage("Could not remove the shortcut from browser storage.");
                      setGroupDraft(null);
                      return;
                    }
                    void navigate({ to: "/" });
                  }}
                >
                  <Trash2 size={16} />
                  {t("Remove group shortcut")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Removes this shortcut from this browser, not the shared group or its concerts.",
                  )}
                </p>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(groupSharingLink(groupId, key));
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setMessage(
                  `${t("Could not copy automatically. Your sharing link:")} ${groupSharingLink(groupId, key)}`,
                );
              }
            }}
          >
            <Copy size={16} />
            {copied ? t("Copied") : t("Share group")}
          </Button>
        </div>
      </header>
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
      <div className="flex flex-col gap-6">
        <section className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{t("Concerts")}</h2>
            {concerts.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="ml-auto"
                onClick={() => setAddingConcert(!addingConcert)}
              >
                <Plus size={16} />
                {addingConcert ? t("Cancel") : t("Create concert")}
              </Button>
            )}
          </div>
          {(addingConcert || !concerts.length) && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
            >
              <Input
                aria-label={t("Concert name")}
                placeholder={t("An evening of music")}
                value={concertTitle}
                onChange={(event) => setConcertTitle(event.target.value)}
                required
                maxLength={160}
              />
              <label htmlFor="group-concert-date">{t("Date (optional)")}</label>
              <DatePicker id="group-concert-date" value={date} onChange={setDate} />
              <Button disabled={busy}>
                <Plus size={16} />
                {t("Create concert")}
              </Button>
            </form>
          )}
          {!concerts.length && (
            <p className="text-sm text-muted-foreground">
              {t("Create your first concert for this group.")}
            </p>
          )}
          <div className="grid grid-cols-1 gap-2">
            {concerts.map((concert) => (
              <Link
                key={concert.id}
                className="concert-card rounded-lg border p-3"
                to="/c/$concertId"
                params={{ concertId: concert.id }}
                hash={`key=${key}`}
              >
                <h3 className="font-semibold break-words">{concert.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {concert.date ? formatUiDate(concert.date) : t("Date to be decided")}
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{t("Group players")}</h2>
            {group.players.length > 0 && (
              <div className="ml-auto">
                <EditToggle
                  editing={editingPlayers}
                  editLabel={t("Edit players")}
                  onClick={() => setEditingPlayers(!editingPlayers)}
                />
              </div>
            )}
          </div>
          {(editingPlayers || !group.players.length) && (
            <form
              className="flex max-w-xl flex-col items-start gap-2 sm:flex-row sm:items-center"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await save({
                    type: "player",
                    expectedRevision: group.revision,
                    player: { kind: "player", id: crypto.randomUUID(), name },
                  })
                ) {
                  setName("");
                }
              }}
            >
              <Input
                className="sm:flex-1"
                aria-label={t("Player name")}
                placeholder={t("Player name")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={160}
              />
              <Button disabled={busy}>
                <Plus size={16} />
                {t("Add player")}
              </Button>
            </form>
          )}
          <ul className="space-y-2">
            {group.players.map((player) => (
              <li key={player.id} className="rounded-lg border p-3">
                {editingPlayers && playerDraft?.player.id === player.id ? (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (
                        await save({
                          type: "player",
                          player: playerDraft.player,
                          expectedRevision: playerDraft.revision,
                        })
                      )
                        setPlayerDraft(null);
                    }}
                  >
                    <Input
                      aria-label={t("Edit player name")}
                      required
                      maxLength={160}
                      value={playerDraft.player.name}
                      onChange={(event) =>
                        setPlayerDraft({
                          ...playerDraft,
                          player: { ...playerDraft.player, name: event.target.value },
                        })
                      }
                    />
                    <Button disabled={busy}>{t("Save")}</Button>
                    <Button type="button" variant="ghost" onClick={() => setPlayerDraft(null)}>
                      {t("Cancel")}
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 break-words">
                      <p className="font-medium">{player.name}</p>
                    </div>
                    {editingPlayers && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("Edit {name}", { name: player.name })}
                          onClick={() => setPlayerDraft({ player, revision: group.revision })}
                        >
                          <Pencil size={15} />
                        </Button>
                        {!concerts.length && (
                          <DeleteButton
                            label={player.name}
                            busy={busy}
                            onDelete={() =>
                              save({
                                type: "deletePlayer",
                                id: player.id,
                                expectedRevision: group.revision,
                              })
                            }
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {editingPlayers && concerts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t(
                "Group players cannot be removed after concerts have been created, to preserve concert history.",
              )}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
