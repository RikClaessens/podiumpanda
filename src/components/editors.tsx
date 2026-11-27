import { useLanguage } from "../lib/language";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { ofKind, orderedEntries, type Edit, type OfKind, type Snapshot } from "../../shared/model";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { formatUiDate } from "../../shared/dates";
import { Picker } from "./picker";
import { DatePicker } from "./date-picker";
import { MediaPlayer } from "./media-player";
import { EditToggle } from "./edit-toggle";
export type EditorProps = {
  snapshot: Snapshot;
  busy: boolean;
  onEdit: (edit: Edit, revision?: number) => Promise<boolean>;
};
export function Players({ snapshot, busy, onEdit }: EditorProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const players = ofKind(snapshot, "player");
  const [editing, setEditing] = useState(false);
  const groupPlayers = new Set(snapshot.groupPlayerIds ?? []);
  return (
    <section className="panel space-y-5">
      <div>
        <h2 className="section-title">{t("Who\u2019s playing?")}</h2>
        <p className="text-sm text-muted-foreground">
          {snapshot.concert.groupId
            ? t("Group players are managed in the group. Add guests for this concert here.")
            : t("Names, not accounts. Anyone can help keep the roster up to date.")}
        </p>
      </div>
      {players.length > 0 && (
        <EditToggle
          editing={editing}
          onClick={() => setEditing(!editing)}
          editLabel={t("Edit players")}
        />
      )}
      {(editing || !players.length) && (
        <form
          className="flex max-w-xl flex-col items-start gap-2 sm:flex-row sm:items-center"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await onEdit({
                type: "put",
                entity: { kind: "player", id: crypto.randomUUID(), name },
              })
            ) {
              setName("");
            }
          }}
        >
          <Input
            aria-label={t("Player name")}
            placeholder={t("Player name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={160}
            className="sm:flex-1"
          />
          <Button disabled={busy}>
            <Plus size={16} />
            {snapshot.concert.groupId ? t("Add concert guest") : t("Add player")}
          </Button>
        </form>
      )}
      {!players.length && (
        <p className="text-sm text-muted-foreground">
          {t("Add your group to start gathering preferences.")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            snapshot={snapshot}
            busy={busy}
            onEdit={onEdit}
            groupPlayer={groupPlayers.has(player.id)}
            editing={editing}
          />
        ))}
      </div>
    </section>
  );
}
function PlayerRow({
  player,
  snapshot,
  busy,
  onEdit,
  groupPlayer = false,
  editing,
}: EditorProps & {
  player: OfKind<"player">;
  groupPlayer?: boolean;
  editing: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<{
    entity: OfKind<"player">;
    revision: number;
  } | null>(null);
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3">
      {editing && draft ? (
        <form
          className="flex w-full flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onEdit({ type: "put", entity: draft.entity }, draft.revision)) setDraft(null);
          }}
        >
          <Input
            aria-label={t("Edit player name")}
            required
            maxLength={160}
            value={draft.entity.name}
            onChange={(event) =>
              setDraft({ ...draft, entity: { ...draft.entity, name: event.target.value } })
            }
          />
          <Button size="sm" disabled={busy}>
            <Check size={16} />
            {t("Save")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
            {t("Cancel")}
          </Button>
        </form>
      ) : (
        <>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-primary">
            {player.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 break-words">
            <p className="font-medium">{player.name}</p>
            <p className="text-xs text-muted-foreground">
              {groupPlayer ? t("Group player") : snapshot.concert.groupId ? t("Concert guest") : ""}
            </p>
          </div>
          {editing && !groupPlayer && (
            <>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Edit {name}", { name: player.name })}
                onClick={() => setDraft({ entity: player, revision: snapshot.concert.revision })}
              >
                <Pencil size={15} />
              </Button>
              <DeleteButton
                label={player.name}
                busy={busy}
                onDelete={() => onEdit({ type: "delete", id: player.id })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
export function DeleteButton({
  label,
  busy,
  onDelete,
}: {
  label: string;
  busy: boolean;
  onDelete: () => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <span className="flex items-center gap-1">
      <Button
        size="sm"
        variant="destructive"
        disabled={busy}
        onClick={async () => {
          if (await onDelete()) setConfirming(false);
        }}
      >
        {t("Delete?")}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("Cancel deletion")}
        onClick={() => setConfirming(false)}
      >
        <X size={14} />
      </Button>
    </span>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      disabled={busy}
      aria-label={t("Delete {name}", { name: label })}
      onClick={() => setConfirming(true)}
    >
      <Trash2 size={15} />
    </Button>
  );
}
export function Setlist({ snapshot, busy, onEdit }: EditorProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const entries = orderedEntries(snapshot);
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  return (
    <section className="space-y-4">
      <div className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">{t("The programme")}</h2>
          <span className="text-sm text-muted-foreground">
            {entries.length}
            {" " + t("pieces \u00B7") + " "}
            {total} min
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={entries.length ? "outline" : "default"}
            onClick={() => setAdding(!adding)}
          >
            <Plus size={16} />
            {adding ? t("Cancel") : t("Add piece")}
          </Button>
          {entries.length > 0 && (
            <EditToggle
              variant="ghost"
              editing={editing}
              onClick={() => setEditing(!editing)}
              editLabel={t("Edit setlist")}
            />
          )}
        </div>
        {adding && (
          <form
            className="flex max-w-xl flex-col items-start gap-2 sm:flex-row sm:items-center"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await onEdit({
                  type: "put",
                  entity: {
                    kind: "entry",
                    id: crypto.randomUUID(),
                    title,
                    notes: "",
                    durationMinutes: 0,
                    mediaUrl: "",
                    order: entries.length
                      ? Math.max(...entries.map((entry) => entry.order)) + 1
                      : 0,
                    floorplanId: null,
                  },
                })
              ) {
                setTitle("");
                setAdding(false);
                setEditing(true);
              }
            }}
          >
            <Input
              aria-label={t("Piece title")}
              placeholder={t("Add a piece to the setlist")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={160}
              className="sm:flex-1"
            />
            <Button disabled={busy}>
              <Plus size={16} />
              {t("Add piece")}
            </Button>
          </form>
        )}
        {!entries.length && (
          <p className="text-sm text-muted-foreground">
            {t("Build your setlist, then add whichever parts each piece needs.")}
          </p>
        )}
      </div>
      {entries.map((entry, index) => (
        <EntryCard key={entry.id} {...{ entry, index, snapshot, busy, onEdit, editing }} />
      ))}
    </section>
  );
}
function EntryCard({
  entry,
  index,
  snapshot,
  busy,
  onEdit,
  editing,
}: EditorProps & {
  entry: OfKind<"entry">;
  index: number;
  editing: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<{
    entity: OfKind<"entry">;
    revision: number;
  } | null>(null);
  const [partName, setPartName] = useState("");
  const entries = orderedEntries(snapshot);
  const parts = ofKind(snapshot, "part").filter((part) => part.entryId === entry.id);
  async function move(offset: number) {
    const ids = entries.map((item) => item.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    await onEdit({ type: "reorder", entryIds: ids });
  }
  return (
    <article className="piece-enter piece-card panel space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold dark:bg-lilac dark:text-[#301348]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
          <h3 className="text-lg font-semibold break-words">{entry.title}</h3>
          <p className="text-xs text-muted-foreground">
            {entry.durationMinutes ? `${entry.durationMinutes} min · ` : ""}
            {parts.length} {t("parts")}
          </p>
        </div>
        {editing && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              disabled={busy || index === 0}
              aria-label={t("Move {name} up", { name: entry.title })}
              onClick={() => move(-1)}
            >
              <ArrowUp size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy || index === entries.length - 1}
              aria-label={t("Move {name} down", { name: entry.title })}
              onClick={() => move(1)}
            >
              <ArrowDown size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("Edit {name}", { name: entry.title })}
              onClick={() => setDraft({ entity: entry, revision: snapshot.concert.revision })}
            >
              <Pencil size={15} />
            </Button>
            <DeleteButton
              label={entry.title}
              busy={busy}
              onDelete={() => onEdit({ type: "delete", id: entry.id })}
            />
          </div>
        )}
      </div>
      {editing && draft && (
        <form
          className="grid gap-3 rounded-lg bg-muted p-3 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onEdit({ type: "put", entity: draft.entity }, draft.revision)) setDraft(null);
          }}
        >
          <div className="field">
            <label htmlFor={`title-${entry.id}`}>{t("Title")}</label>
            <Input
              id={`title-${entry.id}`}
              required
              maxLength={160}
              value={draft.entity.title}
              onChange={(event) =>
                setDraft({ ...draft, entity: { ...draft.entity, title: event.target.value } })
              }
            />
          </div>
          <div className="field">
            <label htmlFor={`duration-${entry.id}`}>{t("Duration (minutes)")}</label>
            <Input
              id={`duration-${entry.id}`}
              type="number"
              min={0}
              max={1440}
              step="0.5"
              value={draft.entity.durationMinutes}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  entity: { ...draft.entity, durationMinutes: Number(event.target.value) },
                })
              }
            />
          </div>
          <div className="field md:col-span-2">
            <label htmlFor={`media-${entry.id}`}>{t("Music link (optional)")}</label>
            <Input
              id={`media-${entry.id}`}
              type="url"
              maxLength={2048}
              placeholder="https://…"
              value={draft.entity.mediaUrl}
              onChange={(event) =>
                setDraft({ ...draft, entity: { ...draft.entity, mediaUrl: event.target.value } })
              }
            />
          </div>
          <div className="field md:col-span-2">
            <label htmlFor={`notes-${entry.id}`}>{t("Notes")}</label>
            <Textarea
              id={`notes-${entry.id}`}
              maxLength={2000}
              value={draft.entity.notes}
              onChange={(event) =>
                setDraft({ ...draft, entity: { ...draft.entity, notes: event.target.value } })
              }
            />
          </div>
          <div className="field">
            <label htmlFor={`plan-${entry.id}`}>{t("Floorplan")}</label>
            <Picker
              id={`plan-${entry.id}`}
              value={draft.entity.floorplanId ?? ""}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  entity: { ...draft.entity, floorplanId: value || null },
                })
              }
              options={[
                { value: "", label: t("Concert default") },
                ...ofKind(snapshot, "floorplan").map((plan) => ({
                  value: plan.id,
                  label: plan.name,
                })),
              ]}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" disabled={busy}>
              {t("Save piece")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t("Cancel")}
            </Button>
          </div>
        </form>
      )}
      {entry.notes && (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {entry.notes}
        </p>
      )}
      {entry.mediaUrl && <MediaPlayer key={entry.mediaUrl} id={entry.id} url={entry.mediaUrl} />}
      <div className="flex flex-wrap gap-2">
        {parts.map((part) => (
          <PartPill key={part.id} {...{ part, snapshot, busy, onEdit, editing }} />
        ))}
      </div>
      {editing && (
        <form
          className="flex max-w-md flex-col items-start gap-2 sm:flex-row sm:items-center"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await onEdit({
                type: "put",
                entity: {
                  kind: "part",
                  id: crypto.randomUUID(),
                  entryId: entry.id,
                  name: partName,
                  notes: "",
                },
              })
            )
              setPartName("");
          }}
        >
          <Input
            aria-label={t("New part for {name}", { name: entry.title })}
            placeholder={t("Part name, e.g. Violin 1")}
            required
            maxLength={160}
            className="sm:flex-1"
            value={partName}
            onChange={(event) => setPartName(event.target.value)}
          />
          <Button variant="outline" disabled={busy}>
            <Plus size={16} />
            {t("Part")}
          </Button>
        </form>
      )}
    </article>
  );
}
function PartPill({
  part,
  snapshot,
  busy,
  onEdit,
  editing,
}: EditorProps & {
  part: OfKind<"part">;
  editing: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<{
    entity: OfKind<"part">;
    revision: number;
  } | null>(null);
  return (
    <div className="flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 dark:border-[#705b84] dark:bg-[#4b3560]">
      {editing && draft ? (
        <form
          className="flex flex-wrap gap-1"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onEdit({ type: "put", entity: draft.entity }, draft.revision)) setDraft(null);
          }}
        >
          <Input
            aria-label={t("Part name")}
            required
            maxLength={160}
            value={draft.entity.name}
            onChange={(event) =>
              setDraft({ ...draft, entity: { ...draft.entity, name: event.target.value } })
            }
          />
          <Input
            aria-label={t("Part notes")}
            placeholder={t("Notes (optional)")}
            maxLength={2000}
            value={draft.entity.notes}
            onChange={(event) =>
              setDraft({ ...draft, entity: { ...draft.entity, notes: event.target.value } })
            }
          />
          <Button size="sm" disabled={busy}>
            {t("Save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
            {t("Cancel")}
          </Button>
        </form>
      ) : (
        <>
          <span className="break-all text-sm" title={part.notes}>
            {part.name}
          </span>
          {editing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Edit part {name}", { name: part.name })}
                onClick={() => setDraft({ entity: part, revision: snapshot.concert.revision })}
              >
                <Pencil size={12} />
              </Button>
              <DeleteButton
                label={part.name}
                busy={busy}
                onDelete={() => onEdit({ type: "delete", id: part.id })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
export function Preferences({
  snapshot,
  busy,
  onEdit,
  selectedPlayer,
}: EditorProps & {
  selectedPlayer: string;
}) {
  const { t } = useLanguage();
  const players = ofKind(snapshot, "player");
  const parts = ofKind(snapshot, "part");
  const entries = orderedEntries(snapshot);
  const preferences = ofKind(snapshot, "preference");
  const [editing, setEditing] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState("");
  const [onlyMe, setOnlyMe] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<
    Record<string, { value: string; revision: number } | null>
  >({});
  const myPlayer = players.find((player) => player.id === selectedPlayer);
  const editor = players.find((player) => player.id === editingPlayer);
  const visiblePlayers =
    editing && editor ? [editor] : !editing && onlyMe && myPlayer ? [myPlayer] : players;
  const byPair = new Map(
    preferences.map((preference) => [`${preference.partId}:${preference.playerId}`, preference]),
  );
  return (
    <section className="panel min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{t("What would everyone like to play?")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("Preferences are suggestions, not final assignments.")}
          </p>
        </div>
        {!editing && myPlayer && (
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyMe} onCheckedChange={(checked) => setOnlyMe(checked === true)} />
            {t("Only show me")}
          </label>
        )}
      </div>
      {players.length > 0 && parts.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <EditToggle
            editing={editing}
            editLabel={t("Edit preferences")}
            onClick={() => {
              if (!editing) setEditingPlayer(myPlayer?.id ?? "");
              setEditing(!editing);
            }}
          />
          {editing && (
            <div className="field min-w-0 max-w-full">
              <label htmlFor="preference-player">{t("Editing preferences for")}</label>
              <Picker
                id="preference-player"
                value={editingPlayer}
                onValueChange={setEditingPlayer}
                options={[
                  { value: "", label: t("Choose a player") },
                  ...players.map((player) => ({ value: player.id, label: player.name })),
                ]}
              />
            </div>
          )}
        </div>
      )}
      {!players.length || !parts.length ? (
        <p className="text-muted-foreground">{t("Add players and setlist parts first.")}</p>
      ) : (
        <>
          {editing && !editor && (
            <p className="text-sm text-muted-foreground">
              {t("Choose a player to edit their preferences.")}
            </p>
          )}
          {visiblePlayers.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {t("Scroll sideways to see all players.")}
            </p>
          )}
          <Table className="w-full table-fixed border-separate border-spacing-0">
            <TableHeader>
              <TableRow>
                <TableHead
                  scope="col"
                  className={`sticky left-0 z-10 bg-card whitespace-normal ${editing && editor ? "w-[38%]" : "w-32 sm:w-48"}`}
                >
                  {t("Piece / part")}
                </TableHead>
                {visiblePlayers.map((player) => (
                  <TableHead
                    key={player.id}
                    scope="col"
                    className={`${editing && editor ? "w-[62%]" : "w-40"} whitespace-normal break-words`}
                  >
                    {player.name}
                    {player.id === selectedPlayer ? t(" (you)") : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            {entries.map((entry) => {
              const entryParts = parts.filter((part) => part.entryId === entry.id);
              if (!entryParts.length) return null;
              return (
                <TableBody key={entry.id}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <th
                      scope="rowgroup"
                      colSpan={visiblePlayers.length + 1}
                      className="p-2 text-left font-heading text-base font-bold"
                    >
                      <span className="sticky left-2 inline-block max-w-32 break-words sm:max-w-48">
                        {entry.title}
                      </span>
                    </th>
                  </TableRow>
                  {entryParts.map((part) => (
                    <TableRow key={part.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card p-2 text-left align-top font-medium whitespace-normal break-words"
                      >
                        {part.name}
                        {part.notes && (
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            {part.notes}
                          </p>
                        )}
                      </th>
                      {visiblePlayers.map((player) => {
                        const pair = `${part.id}:${player.id}`;
                        const preference = byPair.get(pair);
                        return (
                          <TableCell
                            key={player.id}
                            className="align-top whitespace-normal break-words"
                          >
                            {editing && editor ? (
                              <PreferenceCell
                                {...{ snapshot, busy, onEdit, player, part, entry, preference }}
                                note={noteDrafts[pair] ?? null}
                                setNote={(note) =>
                                  setNoteDrafts((drafts) => ({ ...drafts, [pair]: note }))
                                }
                              />
                            ) : preference ? (
                              <>
                                <PreferenceLabel value={preference.value} />
                                {preference.note && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {preference.note}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span
                                className="text-muted-foreground"
                                aria-label={t("No preference")}
                              >
                                —
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              );
            })}
          </Table>
        </>
      )}
    </section>
  );
}

export function Allocation({
  snapshot,
  busy,
  onEdit,
  selectedPlayer,
}: EditorProps & {
  selectedPlayer: string;
}) {
  const { t } = useLanguage();
  const players = ofKind(snapshot, "player");
  const parts = ofKind(snapshot, "part");
  const preferences = ofKind(snapshot, "preference");
  const assignments = ofKind(snapshot, "assignment");
  const entries = orderedEntries(snapshot);
  const [onlyMe, setOnlyMe] = useState(false);
  const [editing, setEditing] = useState(false);
  const showMine = onlyMe && !!selectedPlayer;
  const visiblePlayers = showMine
    ? players.filter((player) => player.id === selectedPlayer)
    : players;
  const myPartIds = new Set(
    assignments.filter((assignment) => assignment.playerId === selectedPlayer).map((a) => a.partId),
  );
  const entriesWithParts = entries
    .map((entry) => ({
      entry,
      parts: parts.filter(
        (part) => part.entryId === entry.id && (!showMine || myPartIds.has(part.id)),
      ),
    }))
    .filter((item) => item.parts.length > 0);
  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{t("Give everyone their part")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Assign several players to a part, and several parts to a player. Preferences don\u2019t restrict your decisions.",
            )}
          </p>
        </div>
        {selectedPlayer && (
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyMe} onCheckedChange={(checked) => setOnlyMe(checked === true)} />
            {t("Only show me")}
          </label>
        )}
      </div>
      {players.length > 0 && parts.length > 0 && (
        <EditToggle
          editing={editing}
          onClick={() => setEditing(!editing)}
          editLabel={t("Edit assignments")}
        />
      )}
      {editing && showMine && (
        <p className="text-sm text-muted-foreground">
          {t("Turn off Only show me to assign more parts.")}
        </p>
      )}
      {!players.length || !parts.length ? (
        <p className="text-muted-foreground">{t("Add players and setlist parts first.")}</p>
      ) : showMine && !entriesWithParts.length ? (
        <p className="text-muted-foreground">{t("No parts assigned to you yet.")}</p>
      ) : (
        <div className="space-y-4">
          {entriesWithParts.map(({ entry, parts: entryParts }) => (
            <section key={entry.id} className="rounded-lg border p-3">
              <h3 className="font-semibold break-words">{entry.title}</h3>
              <div className="mt-2 divide-y">
                {entryParts.map((part) => {
                  const related = visiblePlayers.map((player) => ({
                    player,
                    pref: preferences.find(
                      (item) => item.playerId === player.id && item.partId === part.id,
                    ),
                    assignment: assignments.find(
                      (item) => item.playerId === player.id && item.partId === part.id,
                    ),
                  }));
                  const visible = editing ? related : related.filter((item) => item.assignment);
                  return (
                    <div
                      key={part.id}
                      className={`grid min-w-0 gap-x-4 gap-y-1 py-1.5 ${
                        editing || showMine ? "" : "min-[480px]:grid-cols-2"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">{part.name}</p>
                        {part.notes && (
                          <p className="text-xs text-muted-foreground break-words">{part.notes}</p>
                        )}
                      </div>
                      {editing ? (
                        <div className="space-y-2">
                          {visible.map(({ player, pref, assignment }) => (
                            <div
                              key={player.id}
                              className="flex min-w-0 flex-wrap items-start justify-between gap-2 text-sm"
                            >
                              <label className="flex min-w-0 max-w-full items-center gap-2">
                                <Checkbox
                                  checked={!!assignment}
                                  disabled={busy}
                                  aria-label={t("Assign {player} to {part} in {entry}", {
                                    player: player.name,
                                    part: part.name,
                                    entry: entry.title,
                                  })}
                                  onCheckedChange={() => {
                                    void onEdit(
                                      assignment
                                        ? { type: "delete", id: assignment.id }
                                        : {
                                            type: "put",
                                            entity: {
                                              kind: "assignment",
                                              id: crypto.randomUUID(),
                                              playerId: player.id,
                                              partId: part.id,
                                            },
                                          },
                                    );
                                  }}
                                />
                                <span className="min-w-0 break-words">{player.name}</span>
                              </label>
                              <span className="text-xs text-muted-foreground break-words">
                                {pref ? <PreferenceLabel value={pref.value} /> : t("No preference")}
                                {pref?.note ? ` · ${pref.note}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : !showMine ? (
                        <p className="min-w-0 text-sm break-words">
                          {visible.length ? (
                            visible.map(({ player, pref }, index) => (
                              <span key={player.id}>
                                {index > 0 && ", "}
                                {player.name}
                                {player.id === selectedPlayer ? t(" (you)") : ""}
                                {pref?.value === "favorite" && (
                                  <span className="ml-1 inline-flex align-middle">
                                    <span className="sr-only"> {t("Favorite")}</span>
                                    <FavoriteStar />
                                  </span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">
                              {t("No players assigned")}
                            </span>
                          )}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
const preferenceLabels = {
  favorite: "Favorite",
  keen: "Keen to play",
  okay: "Happy to play",
  "rather-not": "Prefer not to",
  unavailable: "Unavailable",
} satisfies Record<OfKind<"preference">["value"], string>;

function FavoriteStar() {
  return <Star aria-hidden="true" className="size-4 shrink-0 fill-yellow stroke-none" />;
}

function PreferenceLabel({ value }: { value: OfKind<"preference">["value"] }) {
  const { t } = useLanguage();
  return (
    <span
      className={
        value === "favorite" ? "inline-flex items-center gap-1 font-semibold text-primary" : ""
      }
    >
      {value === "favorite" && <FavoriteStar />}
      {t(preferenceLabels[value])}
    </span>
  );
}

const preferenceValues = [
  "favorite",
  "keen",
  "okay",
  "rather-not",
  "unavailable",
] as const satisfies readonly OfKind<"preference">["value"][];
function PreferenceCell({
  snapshot,
  busy,
  onEdit,
  player,
  part,
  entry,
  preference,
  note,
  setNote,
}: EditorProps & {
  player: OfKind<"player">;
  part: OfKind<"part">;
  entry: OfKind<"entry">;
  preference?: OfKind<"preference">;
  note: { value: string; revision: number } | null;
  setNote: (note: { value: string; revision: number } | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0 max-w-full space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        {preference?.value === "favorite" && <FavoriteStar />}
        <Picker
          className="min-h-9 w-full data-[size=default]:h-auto [&_[data-slot=select-value]]:whitespace-normal"
          ariaLabel={t("{player} preference for {part} in {entry}", {
            player: player.name,
            part: part.name,
            entry: entry.title,
          })}
          value={preference?.value ?? ""}
          disabled={busy}
          onValueChange={(selected) => {
            const value = preferenceValues.find((item) => item === selected);
            if (value)
              void onEdit({
                type: "put",
                entity: {
                  kind: "preference",
                  id: preference?.id ?? crypto.randomUUID(),
                  playerId: player.id,
                  partId: part.id,
                  value,
                  note: preference?.note ?? "",
                },
              });
            else if (selected === "" && preference)
              void onEdit({ type: "delete", id: preference.id });
            else if (selected !== "") console.error("Invalid preference value:", selected);
          }}
          options={[
            { value: "", label: t("No preference") },
            ...preferenceValues.map((value) => ({ value, label: t(preferenceLabels[value]) })),
          ]}
        />
      </div>
      {preference &&
        (note ? (
          <form
            className="space-y-1"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await onEdit(
                  { type: "put", entity: { ...preference, note: note.value } },
                  note.revision,
                )
              )
                setNote(null);
            }}
          >
            <Input
              aria-label={t("Preference note for {player}, {part} in {entry}", {
                player: player.name,
                part: part.name,
                entry: entry.title,
              })}
              value={note.value}
              maxLength={500}
              onChange={(event) => setNote({ ...note, value: event.target.value })}
            />
            <Button size="sm" variant="outline" disabled={busy}>
              {t("Save note")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setNote(null)}>
              {t("Cancel")}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto max-w-full whitespace-normal break-words p-0 text-left text-xs text-muted-foreground"
            onClick={() => setNote({ value: preference.note, revision: snapshot.concert.revision })}
          >
            {preference.note || t("+ Add note")}
          </Button>
        ))}
    </div>
  );
}
export function ConcertSettings({ snapshot, busy, onEdit }: EditorProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ ...snapshot.concert });
  const [revision, setRevision] = useState(snapshot.concert.revision);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    const plan = ofKind(snapshot, "floorplan").find(
      (item) => item.id === snapshot.concert.defaultFloorplanId,
    );
    return (
      <section className="panel max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">{t("Concert details")}</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft({ ...snapshot.concert });
              setRevision(snapshot.concert.revision);
              setEditing(true);
            }}
          >
            <Pencil size={16} />
            {t("Edit details")}
          </Button>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("Name")}</dt>
            <dd className="break-words">{snapshot.concert.title}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Date")}</dt>
            <dd>
              {snapshot.concert.date
                ? formatUiDate(snapshot.concert.date)
                : t("Date to be decided")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Notes")}</dt>
            <dd className="whitespace-pre-wrap break-words">{snapshot.concert.notes || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Default floorplan")}</dt>
            <dd className="break-words">{plan?.name ?? t("None")}</dd>
          </div>
        </dl>
      </section>
    );
  }
  return (
    <form
      className="panel grid max-w-2xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          await onEdit(
            {
              type: "concert",
              title: draft.title,
              date: draft.date,
              notes: draft.notes,
              defaultFloorplanId: draft.defaultFloorplanId,
            },
            revision,
          )
        ) {
          setEditing(false);
        }
      }}
    >
      <h2 className="section-title">{t("Concert details")}</h2>
      <div className="field">
        <label htmlFor="settings-title">{t("Name")}</label>
        <Input
          id="settings-title"
          value={draft.title}
          required
          maxLength={160}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="settings-date">{t("Date")}</label>
        <DatePicker
          id="settings-date"
          value={draft.date}
          onChange={(value) => setDraft({ ...draft, date: value })}
        />
      </div>
      <div className="field">
        <label htmlFor="settings-notes">{t("Notes")}</label>
        <Textarea
          id="settings-notes"
          maxLength={2000}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="default-floorplan">{t("Default floorplan")}</label>
        <Picker
          id="default-floorplan"
          value={draft.defaultFloorplanId ?? ""}
          onValueChange={(value) => setDraft({ ...draft, defaultFloorplanId: value || null })}
          options={[
            { value: "", label: t("None") },
            ...ofKind(snapshot, "floorplan").map((plan) => ({ value: plan.id, label: plan.name })),
          ]}
        />
      </div>
      {snapshot.concert.revision !== revision && (
        <p className="text-sm text-muted-foreground">
          {t(
            "Changes arrived while this form was open. Cancel and reopen it to load the latest details.",
          )}
        </p>
      )}
      <Button disabled={busy} className="justify-self-start">
        {t("Save details")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="justify-self-start"
        onClick={() => setEditing(false)}
      >
        {t("Cancel")}
      </Button>
    </form>
  );
}
