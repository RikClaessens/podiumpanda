import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import {
  applyCommand,
  concertSchema,
  entitySchema,
  groupSchema,
  DomainError,
  type Command,
  type Group,
  type GroupEdit,
  type Snapshot,
} from "../shared/model.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const historySchema = z.object({
  revision: z.number().int(),
  at: z.iso.datetime(),
  description: z.string(),
});
const undoSchema = z.object({
  concert: concertSchema,
  before: z.array(entitySchema),
  after: z.array(entitySchema),
});

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function validToken(token: string, hash: string) {
  const candidate = Buffer.from(tokenHash(token), "hex");
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export function changesBetween(before: Snapshot, after: Snapshot) {
  const previous = new Map(before.entities.map((entity) => [entity.id, entity]));
  const next = new Map(after.entities.map((entity) => [entity.id, entity]));
  const ids = [...new Set([...previous.keys(), ...next.keys()])].filter(
    (id) => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id)),
  );
  if (ids.length > 80)
    throw new HttpError(422, "This edit affects too many items. Delete smaller groups first.");
  return { ids, previous, next };
}

export class ConcertStore {
  private table: string;
  private db: DynamoDBDocumentClient;
  constructor(
    table: string,
    db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {
    this.table = table;
    this.db = db;
  }

  async createGroup(input: { name: string; icon: Group["icon"] }) {
    const id = randomUUID();
    const key = randomBytes(32).toString("base64url");
    const group = groupSchema.parse({
      id,
      name: input.name,
      icon: input.icon,
      revision: 0,
      players: [],
      concertIds: [],
    });
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table,
              Item: { PK: `GROUP#${id}`, SK: "META", ...group, tokenHash: tokenHash(key) },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
    return { id, key };
  }

  private async groupMetadata(id: string, token: string): Promise<Group> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `GROUP#${id}`, SK: "META" },
        ConsistentRead: true,
      }),
    );
    const hash = result.Item?.tokenHash;
    if (typeof hash !== "string" || !validToken(token, hash))
      throw new HttpError(404, "Group not found or the sharing key is invalid.");
    return groupSchema.parse(result.Item);
  }

  async readGroup(id: string, token: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const group = await this.groupMetadata(id, token);
      const concerts = await Promise.all(
        group.concertIds.map(async (concertId) => {
          const concert = await this.metadata(concertId, token);
          if (concert.groupId !== id)
            throw new HttpError(500, "Group concert data is inconsistent.");
          return concert;
        }),
      );
      if ((await this.groupMetadata(id, token)).revision === group.revision)
        return { group, concerts };
    }
    throw new HttpError(409, "The group is being edited. Please try again.");
  }

  async editGroup(id: string, token: string, edit: GroupEdit) {
    const group = await this.groupMetadata(id, token);
    if (group.revision !== edit.expectedRevision)
      throw new DomainError("This group changed. Refresh and try your edit again.");
    let next = { ...group };
    if (edit.type === "name") next.name = edit.name;
    if (edit.type === "icon") next.icon = edit.icon;
    if (edit.type === "details") {
      next.name = edit.name;
      next.icon = edit.icon;
    }
    if (edit.type === "player") {
      const existing = group.players.some((player) => player.id === edit.player.id);
      const player = existing ? edit.player : { ...edit.player, id: randomUUID() };
      next.players = [...group.players.filter((item) => item.id !== player.id), player];
    }
    if (edit.type === "deletePlayer") {
      if (!group.players.some((player) => player.id === edit.id))
        throw new DomainError("That player no longer exists.");
      if (group.concertIds.length)
        throw new DomainError(
          "Group players cannot be removed after concerts have been created, to preserve concert history.",
        );
      next.players = group.players.filter((player) => player.id !== edit.id);
    }
    next = groupSchema.parse({ ...next, revision: group.revision + 1 });
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.table,
              Key: { PK: `GROUP#${id}`, SK: "META" },
              UpdateExpression:
                "SET #name = :name, #icon = :icon, players = :players, revision = :next",
              ConditionExpression: "revision = :expected",
              ExpressionAttributeNames: { "#name": "name", "#icon": "icon" },
              ExpressionAttributeValues: {
                ":name": next.name,
                ":icon": next.icon,
                ":players": next.players,
                ":next": next.revision,
                ":expected": group.revision,
              },
            },
          },
        ],
      }),
    );
    return this.readGroup(id, token);
  }

  async createGroupConcert(
    groupId: string,
    token: string,
    input: { title: string; date: string; floorplanName?: string },
  ) {
    const group = await this.groupMetadata(groupId, token);
    if (group.concertIds.length >= 100)
      throw new HttpError(422, "This group has reached its concert limit.");
    const id = randomUUID();
    const floorplanId = randomUUID();
    const concert = concertSchema.parse({
      ...input,
      id,
      groupId,
      notes: "",
      defaultFloorplanId: floorplanId,
      revision: 0,
      updatedAt: new Date().toISOString(),
    });
    const floorplan = entitySchema.parse({
      kind: "floorplan",
      id: floorplanId,
      name: input.floorplanName ?? "Main stage",
    });
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.table,
              Key: { PK: `GROUP#${groupId}`, SK: "META" },
              UpdateExpression: "SET concertIds = :concerts, revision = :next",
              ConditionExpression: "revision = :expected",
              ExpressionAttributeValues: {
                ":concerts": [...group.concertIds, id],
                ":next": group.revision + 1,
                ":expected": group.revision,
              },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: { PK: `CONCERT#${id}`, SK: "META", ...concert, tokenHash: tokenHash(token) },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: { PK: `CONCERT#${id}`, SK: `DOC#${floorplanId}`, ...floorplan },
            },
          },
        ],
      }),
    );
    return { id };
  }

  async create(input: { title: string; date: string; floorplanName?: string }) {
    const id = randomUUID();
    const key = randomBytes(32).toString("base64url");
    const floorplanId = randomUUID();
    const concert = concertSchema.parse({
      ...input,
      id,
      notes: "",
      defaultFloorplanId: floorplanId,
      revision: 0,
      updatedAt: new Date().toISOString(),
    });
    const floorplan = entitySchema.parse({
      kind: "floorplan",
      id: floorplanId,
      name: input.floorplanName ?? "Main stage",
    });
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table,
              Item: { PK: `CONCERT#${id}`, SK: "META", ...concert, tokenHash: tokenHash(key) },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: { PK: `CONCERT#${id}`, SK: `DOC#${floorplanId}`, ...floorplan },
            },
          },
        ],
      }),
    );
    return { id, key };
  }

  private async metadata(id: string, token: string) {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `CONCERT#${id}`, SK: "META" },
        ConsistentRead: true,
      }),
    );
    const hash = result.Item?.tokenHash;
    if (typeof hash !== "string" || !validToken(token, hash)) {
      throw new HttpError(404, "Concert not found or the sharing key is invalid.");
    }
    return concertSchema.parse(result.Item);
  }

  async read(id: string, token: string): Promise<Snapshot> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const concert = await this.metadata(id, token);
      const group = concert.groupId ? await this.groupMetadata(concert.groupId, token) : undefined;
      const entities: Snapshot["entities"] = [];
      let cursor: Record<string, unknown> | undefined;
      do {
        const result = await this.db.send(
          new QueryCommand({
            TableName: this.table,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: { ":pk": `CONCERT#${id}`, ":prefix": "DOC#" },
            ConsistentRead: true,
            ExclusiveStartKey: cursor,
          }),
        );
        entities.push(...(result.Items ?? []).map((item) => entitySchema.parse(item)));
        cursor = result.LastEvaluatedKey;
      } while (cursor);
      const latest = await this.metadata(id, token);
      const latestGroup = group ? await this.groupMetadata(group.id, token) : undefined;
      if (latest.revision === concert.revision && latestGroup?.revision === group?.revision) {
        if (!group) return { concert, entities };
        const ids = new Set(entities.map((entity) => entity.id));
        if (group.players.some((player) => ids.has(player.id)))
          throw new HttpError(500, "Group and concert player data is inconsistent.");
        return {
          concert,
          entities: [...entities, ...group.players],
          groupRevision: group.revision,
          groupPlayerIds: group.players.map((player) => player.id),
        };
      }
    }
    throw new HttpError(409, "The concert is being edited. Please try again.");
  }

  async edit(id: string, token: string, command: Command) {
    const before = await this.read(id, token);
    const after = applyCommand(before, command);
    const description =
      command.type === "put"
        ? `Saved ${command.entity.kind}`
        : command.type === "delete"
          ? "Deleted item and dependent references"
          : command.type === "reorder"
            ? "Reordered setlist"
            : "Updated concert details";
    await this.persist(before, after, description);
    return after;
  }

  private async persist(before: Snapshot, after: Snapshot, description: string) {
    const { ids, previous, next } = changesBetween(before, after);
    const PK = `CONCERT#${before.concert.id}`;
    const undo = {
      concert: before.concert,
      before: ids.flatMap((id) => (previous.get(id) ? [previous.get(id)!] : [])),
      after: ids.flatMap((id) => (next.get(id) ? [next.get(id)!] : [])),
    };
    if (Buffer.byteLength(JSON.stringify(undo)) > 300_000) {
      throw new HttpError(422, "This edit is too large to save safely. Edit fewer items at once.");
    }
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          ...(before.concert.groupId
            ? [
                {
                  ConditionCheck: {
                    TableName: this.table,
                    Key: { PK: `GROUP#${before.concert.groupId}`, SK: "META" },
                    ConditionExpression: "revision = :revision",
                    ExpressionAttributeValues: { ":revision": before.groupRevision },
                  },
                },
              ]
            : []),
          {
            Update: {
              TableName: this.table,
              Key: { PK, SK: "META" },
              UpdateExpression:
                "SET title = :title, #date = :date, notes = :notes, defaultFloorplanId = :floor, revision = :next, updatedAt = :at",
              ConditionExpression: "revision = :expected",
              ExpressionAttributeNames: { "#date": "date" },
              ExpressionAttributeValues: {
                ":title": after.concert.title,
                ":date": after.concert.date,
                ":notes": after.concert.notes,
                ":floor": after.concert.defaultFloorplanId,
                ":next": after.concert.revision,
                ":at": after.concert.updatedAt,
                ":expected": before.concert.revision,
              },
            },
          },
          ...ids.map((id) =>
            next.has(id)
              ? { Put: { TableName: this.table, Item: { PK, SK: `DOC#${id}`, ...next.get(id) } } }
              : { Delete: { TableName: this.table, Key: { PK, SK: `DOC#${id}` } } },
          ),
          {
            Put: {
              TableName: this.table,
              Item: {
                PK,
                SK: `HISTORY#${String(after.concert.revision).padStart(12, "0")}`,
                revision: after.concert.revision,
                at: after.concert.updatedAt,
                description,
                undo,
              },
            },
          },
        ],
      }),
    );
  }

  async history(id: string, token: string) {
    await this.metadata(id, token);
    const result = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": `CONCERT#${id}`, ":prefix": "HISTORY#" },
        ScanIndexForward: false,
        Limit: 20,
        ConsistentRead: true,
        ProjectionExpression: "revision, #at, description",
        ExpressionAttributeNames: { "#at": "at" },
      }),
    );
    return (result.Items ?? []).map((item) => historySchema.parse(item));
  }

  async undo(id: string, token: string, expectedRevision: number) {
    const before = await this.read(id, token);
    if (before.concert.revision !== expectedRevision)
      throw new DomainError("The concert changed. Refresh before undoing.");
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: {
          PK: `CONCERT#${id}`,
          SK: `HISTORY#${String(expectedRevision).padStart(12, "0")}`,
        },
        ConsistentRead: true,
      }),
    );
    if (!result.Item) throw new HttpError(422, "There is no edit to undo.");
    const undo = undoSchema.parse(result.Item.undo);
    const changed = new Set([...undo.before, ...undo.after].map((entity) => entity.id));
    const after: Snapshot = {
      ...before,
      concert: {
        ...undo.concert,
        revision: expectedRevision + 1,
        updatedAt: new Date().toISOString(),
      },
      entities: [...before.entities.filter((entity) => !changed.has(entity.id)), ...undo.before],
    };
    await this.persist(before, after, `Undid revision ${expectedRevision}`);
    return after;
  }
}
