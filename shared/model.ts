import { z } from "zod";
import { pieceLinkSchema } from "./media";

const id = z.uuid();
const name = z.string().trim().min(1).max(160);
const notes = z.string().max(2000);
const reference = id.nullable();

export const entitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("player"), id, name, instrument: z.string().max(160).optional() }),
  z.object({
    kind: z.literal("entry"),
    id,
    title: name,
    notes,
    durationMinutes: z.number().min(0).max(1440),
    mediaUrl: pieceLinkSchema,
    order: z.number().int().min(0),
    floorplanId: reference,
  }),
  z.object({ kind: z.literal("part"), id, entryId: id, name, notes }),
  z.object({
    kind: z.literal("preference"),
    id,
    playerId: id,
    partId: id,
    value: z.enum(["favorite", "keen", "okay", "rather-not", "unavailable"]),
    note: z.string().max(500),
  }),
  z.object({ kind: z.literal("assignment"), id, playerId: id, partId: id }),
  z.object({ kind: z.literal("floorplan"), id, name }),
  z.object({
    kind: z.literal("object"),
    id,
    floorplanId: id,
    type: z.enum(["chair", "stand", "label", "square", "rectangle", "instrument"]),
    label: z.string().max(160),
    playerId: reference,
    partId: reference,
    x: z.number().min(-1000).max(2000),
    y: z.number().min(-600).max(1150),
    width: z.number().min(10).max(500),
    height: z.number().min(10).max(500),
    rotation: z.number().min(-360).max(360),
  }),
]);

export type Entity = z.infer<typeof entitySchema>;
export type OfKind<K extends Entity["kind"]> = Extract<Entity, { kind: K }>;

export const concertSchema = z.object({
  id,
  title: name,
  date: z.union([z.literal(""), z.iso.date()]),
  notes,
  defaultFloorplanId: reference,
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  groupId: id.optional(),
});
export type Concert = z.infer<typeof concertSchema>;
export const snapshotSchema = z.object({
  concert: concertSchema,
  entities: z.array(entitySchema),
  groupRevision: z.number().int().nonnegative().optional(),
  groupPlayerIds: z.array(id).optional(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const createConcertSchema = z.object({
  title: name,
  date: concertSchema.shape.date,
  floorplanName: name.default("Main stage"),
});
export const groupPlayerSchema = entitySchema.options[0];
export const groupIconSchema = z.enum([
  "users",
  "drum",
  "triangle",
  "cymbal",
  "guitar",
  "piano",
  "keyboard",
  "microphone",
  "vocal",
  "music",
  "music2",
  "music3",
  "music4",
  "listMusic",
  "audioLines",
  "audioWaveform",
  "headphones",
  "speaker",
  "radio",
  "boombox",
  "disc",
  "cassette",
]);
export type GroupIcon = z.infer<typeof groupIconSchema>;
export const groupSchema = z.object({
  id,
  name,
  icon: groupIconSchema.default("users"),
  revision: z.number().int().nonnegative(),
  players: z.array(groupPlayerSchema).max(200),
  concertIds: z.array(id).max(100),
});
export const groupSnapshotSchema = z.object({
  group: groupSchema,
  concerts: z.array(concertSchema),
});
export type Group = z.infer<typeof groupSchema>;
export const groupEditSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("name"), expectedRevision: z.number().int().nonnegative(), name }),
  z.object({
    type: z.literal("details"),
    expectedRevision: z.number().int().nonnegative(),
    name,
    icon: groupIconSchema,
  }),
  z.object({
    type: z.literal("icon"),
    expectedRevision: z.number().int().nonnegative(),
    icon: groupIconSchema,
  }),
  z.object({
    type: z.literal("player"),
    expectedRevision: z.number().int().nonnegative(),
    player: groupPlayerSchema,
  }),
  z.object({
    type: z.literal("deletePlayer"),
    expectedRevision: z.number().int().nonnegative(),
    id,
  }),
]);
export type GroupEdit = z.infer<typeof groupEditSchema>;
export const createGroupSchema = z.object({ name, icon: groupIconSchema.default("users") });
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("put"),
    expectedRevision: z.number().int().nonnegative(),
    entity: entitySchema,
  }),
  z.object({ type: z.literal("delete"), expectedRevision: z.number().int().nonnegative(), id }),
  z.object({
    type: z.literal("concert"),
    expectedRevision: z.number().int().nonnegative(),
    title: name,
    date: concertSchema.shape.date,
    notes,
    defaultFloorplanId: reference,
  }),
  z.object({
    type: z.literal("reorder"),
    expectedRevision: z.number().int().nonnegative(),
    entryIds: z.array(id),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Edit = Command extends infer C
  ? C extends Command
    ? Omit<C, "expectedRevision">
    : never
  : never;

export class DomainError extends Error {}

export function ofKind<K extends Entity["kind"]>(snapshot: Snapshot, kind: K): OfKind<K>[] {
  return snapshot.entities.filter((entity): entity is OfKind<K> => entity.kind === kind);
}

export function orderedEntries(snapshot: Snapshot) {
  return ofKind(snapshot, "entry").sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function applyCommand(snapshot: Snapshot, command: Command): Snapshot {
  if (snapshot.concert.revision !== command.expectedRevision) {
    throw new DomainError("This concert changed. Refresh and try your edit again.");
  }
  let entities = [...snapshot.entities];
  let concert = { ...snapshot.concert };
  if (
    (command.type === "put" && snapshot.groupPlayerIds?.includes(command.entity.id)) ||
    (command.type === "delete" && snapshot.groupPlayerIds?.includes(command.id))
  ) {
    throw new DomainError("Group players must be managed in the group.");
  }
  if (command.type === "put") {
    const existing = entities.find((entity) => entity.id === command.entity.id);
    if (existing && existing.kind !== command.entity.kind) {
      throw new DomainError("An existing item cannot change its type.");
    }
    entities = entities.filter((entity) => entity.id !== command.entity.id);
    entities.push(command.entity);
  } else if (command.type === "delete") {
    const target = entities.find((entity) => entity.id === command.id);
    if (!target) throw new DomainError("That item no longer exists.");
    const removed = new Set([target.id]);
    if (target.kind === "entry") {
      for (const part of ofKind(snapshot, "part")) {
        if (part.entryId === target.id) removed.add(part.id);
      }
    }
    entities = entities
      .filter((entity) => {
        if (removed.has(entity.id)) return false;
        if (entity.kind === "assignment" || entity.kind === "preference") {
          return !removed.has(entity.playerId) && !removed.has(entity.partId);
        }
        if (entity.kind === "object" && removed.has(entity.floorplanId)) return false;
        return true;
      })
      .map((entity) => {
        if (entity.kind === "entry" && entity.floorplanId && removed.has(entity.floorplanId)) {
          return { ...entity, floorplanId: null };
        }
        if (entity.kind === "object") {
          return {
            ...entity,
            playerId: entity.playerId && removed.has(entity.playerId) ? null : entity.playerId,
            partId: entity.partId && removed.has(entity.partId) ? null : entity.partId,
          };
        }
        return entity;
      });
    if (concert.defaultFloorplanId && removed.has(concert.defaultFloorplanId)) {
      concert.defaultFloorplanId = null;
    }
  } else if (command.type === "concert") {
    const { type: _, expectedRevision: __, ...changes } = command;
    concert = { ...concert, ...changes };
  } else {
    const entries = ofKind(snapshot, "entry");
    if (
      new Set(command.entryIds).size !== entries.length ||
      command.entryIds.length !== entries.length ||
      entries.some((entry) => !command.entryIds.includes(entry.id))
    ) {
      throw new DomainError("Reordering must include every setlist entry exactly once.");
    }
    entities = entities.map((entity) =>
      entity.kind === "entry" ? { ...entity, order: command.entryIds.indexOf(entity.id) } : entity,
    );
  }
  validateRelationships({ concert, entities });
  return {
    ...snapshot,
    concert: { ...concert, revision: concert.revision + 1, updatedAt: new Date().toISOString() },
    entities,
  };
}

function validateRelationships(snapshot: Snapshot) {
  const byId = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const requireKind = (value: string | null, kind: Entity["kind"]) => {
    if (value !== null && byId.get(value)?.kind !== kind) {
      throw new DomainError(`The referenced ${kind} does not exist.`);
    }
  };
  requireKind(snapshot.concert.defaultFloorplanId, "floorplan");
  const pairs = new Set<string>();
  for (const entity of snapshot.entities) {
    if (entity.kind === "part") requireKind(entity.entryId, "entry");
    if (entity.kind === "entry") requireKind(entity.floorplanId, "floorplan");
    if (entity.kind === "assignment" || entity.kind === "preference") {
      requireKind(entity.playerId, "player");
      requireKind(entity.partId, "part");
      const pair = `${entity.kind}:${entity.playerId}:${entity.partId}`;
      if (pairs.has(pair)) throw new DomainError("This player already has an item for that part.");
      pairs.add(pair);
    }
    if (entity.kind === "object") {
      requireKind(entity.floorplanId, "floorplan");
      requireKind(entity.playerId, "player");
      requireKind(entity.partId, "part");
    }
  }
}
