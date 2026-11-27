import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConcertStore, changesBetween, tokenHash, validToken } from "./store";
import { fixture } from "../shared/test-fixtures";
import { applyCommand, groupEditSchema } from "../shared/model";

afterEach(() => vi.restoreAllMocks());

describe("DynamoDB concert storage", () => {
  it("updates group name and icon together with one revision check", async () => {
    const id = randomUUID();
    const metadata = {
      id,
      name: "Old",
      icon: "users",
      revision: 3,
      players: [],
      concertIds: [],
      tokenHash: tokenHash("secret"),
    };
    const updated = { ...metadata, name: "New", icon: "drum", revision: 4 };
    const responses = [{ Item: metadata }, {}, { Item: updated }, { Item: updated }];
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const result = await new ConcertStore("Concerts", client).editGroup(
      id,
      "secret",
      groupEditSchema.parse({ type: "details", name: "New", icon: "drum", expectedRevision: 3 }),
    );
    expect(result.group).toMatchObject({ name: "New", icon: "drum", revision: 4 });
    expect(send.mock.calls[1][0].input).toMatchObject({
      TransactItems: [
        {
          Update: {
            ConditionExpression: "revision = :expected",
            ExpressionAttributeValues: {
              ":name": "New",
              ":icon": "drum",
              ":expected": 3,
              ":next": 4,
            },
          },
        },
      ],
    });
  });
  it("stores the selected icon when creating a group", async () => {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const send = vi.spyOn(client, "send").mockImplementation(() => Promise.resolve());
    await new ConcertStore("Concerts", client).createGroup({ name: "Percussion", icon: "drum" });
    expect(send.mock.calls[0][0].input).toMatchObject({
      TransactItems: [{ Put: { Item: { name: "Percussion", icon: "drum", revision: 0 } } }],
    });
  });
  it("persists icon changes on legacy groups with the existing revision guard", async () => {
    const id = randomUUID();
    const metadata = {
      id,
      name: "Group",
      revision: 0,
      players: [],
      concertIds: [],
      tokenHash: tokenHash("secret"),
    };
    const updated = { ...metadata, revision: 1, icon: "drum" };
    const responses = [{ Item: metadata }, {}, { Item: updated }, { Item: updated }];
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const result = await new ConcertStore("Concerts", client).editGroup(
      id,
      "secret",
      groupEditSchema.parse({ type: "icon", icon: "drum", expectedRevision: 0 }),
    );
    expect(result.group.icon).toBe("drum");
    expect(send.mock.calls[1][0].input).toMatchObject({
      TransactItems: [
        {
          Update: {
            ConditionExpression: "revision = :expected",
            ExpressionAttributeValues: { ":icon": "drum", ":expected": 0, ":next": 1 },
          },
        },
      ],
    });
  });
  it("writes and reads a tapered instrument alongside existing floorplan objects", async () => {
    const snapshot = fixture();
    const instrument = {
      kind: "object" as const,
      id: randomUUID(),
      floorplanId: snapshot.concert.defaultFloorplanId!,
      type: "instrument" as const,
      label: "Marimba",
      playerId: null,
      partId: null,
      x: 100,
      y: 120,
      width: 180,
      height: 70,
      rotation: 30,
    };
    const metadata = { ...snapshot.concert, tokenHash: tokenHash("secret") };
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const responses = [
      { Item: metadata },
      { Items: snapshot.entities },
      { Item: metadata },
      {},
      { Item: { ...metadata, revision: 1 } },
      { Items: [...snapshot.entities, instrument] },
      { Item: { ...metadata, revision: 1 } },
    ];
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const store = new ConcertStore("Concerts", client);
    await store.edit(snapshot.concert.id, "secret", {
      type: "put",
      expectedRevision: 0,
      entity: instrument,
    });
    expect(send.mock.calls[3][0].input).toMatchObject({
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({ Item: expect.objectContaining(instrument) }),
        }),
      ]),
    });
    expect((await store.read(snapshot.concert.id, "secret")).entities).toContainEqual(instrument);
  });
  it("writes and reads a favorite preference alongside existing concert data", async () => {
    const snapshot = fixture();
    const [player, , , part] = snapshot.entities;
    const favorite = {
      kind: "preference" as const,
      id: randomUUID(),
      playerId: player.id,
      partId: part.id,
      value: "favorite" as const,
      note: "Solo",
    };
    const metadata = { ...snapshot.concert, tokenHash: tokenHash("secret") };
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const responses = [
      { Item: metadata },
      { Items: snapshot.entities },
      { Item: metadata },
      {},
      { Item: { ...metadata, revision: 1 } },
      { Items: [...snapshot.entities, favorite] },
      { Item: { ...metadata, revision: 1 } },
    ];
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const store = new ConcertStore("Concerts", client);
    await store.edit(snapshot.concert.id, "secret", {
      type: "put",
      expectedRevision: 0,
      entity: favorite,
    });
    expect(send.mock.calls[3][0].input).toMatchObject({
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({ Item: expect.objectContaining(favorite) }),
        }),
      ]),
    });
    const result = await store.read(snapshot.concert.id, "secret");
    expect(result.entities).toContainEqual(favorite);
    expect(result.entities).toEqual(expect.arrayContaining(snapshot.entities));
  });
  it("joins the group roster into concerts but persists only guest changes with a group revision guard", async () => {
    const snapshot = fixture();
    const groupId = randomUUID();
    const rosterPlayer = snapshot.entities[0];
    const concert = { ...snapshot.concert, groupId };
    const metadata = { ...concert, tokenHash: tokenHash("secret") };
    const group = {
      id: groupId,
      name: "Orchestra",
      revision: 3,
      players: [rosterPlayer],
      concertIds: [concert.id],
      tokenHash: tokenHash("secret"),
    };
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const responses = [
      { Item: metadata },
      { Item: group },
      { Items: snapshot.entities.filter((entity) => entity.id !== rosterPlayer.id) },
      { Item: metadata },
      { Item: group },
      {},
    ];
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const guest = { kind: "player" as const, id: randomUUID(), name: "Guest", instrument: "" };
    const after = await new ConcertStore("Concerts", client).edit(concert.id, "secret", {
      type: "put",
      expectedRevision: 0,
      entity: guest,
    });
    expect(after.entities).toEqual(expect.arrayContaining([rosterPlayer, guest]));
    expect(after.groupPlayerIds).toEqual([rosterPlayer.id]);
    expect(send.mock.calls[5][0].input).toMatchObject({
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          ConditionCheck: expect.objectContaining({
            Key: { PK: `GROUP#${groupId}`, SK: "META" },
            ExpressionAttributeValues: { ":revision": 3 },
          }),
        }),
        expect.objectContaining({
          Put: expect.objectContaining({ Item: expect.objectContaining({ id: guest.id }) }),
        }),
      ]),
    });
    expect(JSON.stringify(send.mock.calls[5][0].input)).not.toContain(`DOC#${rosterPlayer.id}`);
  });

  it("prevents removing group players after concerts exist", async () => {
    const id = randomUUID();
    const player = fixture().entities[0];
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    vi.spyOn(client, "send").mockImplementation(() =>
      Promise.resolve({
        Item: {
          id,
          name: "Group",
          revision: 1,
          players: [player],
          concertIds: [randomUUID()],
          tokenHash: tokenHash("secret"),
        },
      }),
    );
    await expect(
      new ConcertStore("Concerts", client).editGroup(id, "secret", {
        type: "deletePlayer",
        id: player.id,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("preserve concert history");
  });
  it("atomically writes only changed documents together with a revision check and undo history", async () => {
    const before = fixture();
    const player = before.entities[0];
    if (player.kind !== "player") throw new Error("Fixture is invalid.");
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const metadata = { ...before.concert, tokenHash: tokenHash("secret") };
    const responses = [{ Item: metadata }, { Items: before.entities }, { Item: metadata }, {}];
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const after = await new ConcertStore("Concerts", client).edit(before.concert.id, "secret", {
      type: "put",
      expectedRevision: 0,
      entity: { ...player, name: "Renamed" },
    });
    expect(after.concert.revision).toBe(1);
    expect(send.mock.calls[3][0].input).toMatchObject({
      TransactItems: [
        {
          Update: {
            ConditionExpression: "revision = :expected",
            ExpressionAttributeValues: { ":expected": 0, ":next": 1 },
          },
        },
        { Put: { Item: { SK: `DOC#${player.id}`, name: "Renamed" } } },
        {
          Put: {
            Item: {
              revision: 1,
              undo: { before: [player], after: [{ ...player, name: "Renamed" }] },
            },
          },
        },
      ],
    });
  });
  it("restores a deleted piece, its parts and allocations with undo", async () => {
    const original = fixture();
    const entry = original.entities[2];
    const deleted = applyCommand(original, { type: "delete", id: entry.id, expectedRevision: 0 });
    const diff = changesBetween(original, deleted);
    const undo = {
      concert: original.concert,
      before: diff.ids.flatMap((id) => (diff.previous.get(id) ? [diff.previous.get(id)!] : [])),
      after: diff.ids.flatMap((id) => (diff.next.get(id) ? [diff.next.get(id)!] : [])),
    };
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const metadata = { ...deleted.concert, tokenHash: tokenHash("secret") };
    const responses = [
      { Item: metadata },
      { Items: deleted.entities },
      { Item: metadata },
      { Item: { undo } },
      {},
    ];
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const restored = await new ConcertStore("Concerts", client).undo(
      original.concert.id,
      "secret",
      1,
    );
    expect(restored.entities).toEqual(expect.arrayContaining(original.entities));
    expect(restored.entities).toHaveLength(original.entities.length);
    expect(restored.concert.revision).toBe(2);
    expect(send.mock.calls[4][0].input).toMatchObject({ TransactItems: expect.any(Array) });
  });
  it("uses strong consistent reads and retries if the revision changes while reading", async () => {
    const snapshot = fixture();
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const metadata = { ...snapshot.concert, tokenHash: tokenHash("secret") };
    const responses = [
      { Item: metadata },
      { Items: snapshot.entities },
      { Item: { ...metadata, revision: 1 } },
      { Item: { ...metadata, revision: 1 } },
      { Items: snapshot.entities },
      { Item: { ...metadata, revision: 1 } },
    ];
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve(responses.shift()));
    const result = await new ConcertStore("Concerts", client).read(snapshot.concert.id, "secret");
    expect(result.concert.revision).toBe(1);
    expect(send).toHaveBeenCalledTimes(6);
    for (const [command] of send.mock.calls)
      expect(command.input).toMatchObject({ ConsistentRead: true });
  });
  it("rejects invalid sharing keys before reading documents", async () => {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
    const send = vi
      .spyOn(client, "send")
      .mockImplementation(() => Promise.resolve({ Item: { tokenHash: tokenHash("correct") } }));
    await expect(new ConcertStore("Concerts", client).read("id", "wrong")).rejects.toThrow(
      "invalid",
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(validToken("wrong", tokenHash("correct"))).toBe(false);
  });
  it("limits multi-item edits to fit a transaction while preserving granular updates", () => {
    const before = fixture();
    const after = {
      ...before,
      entities: before.entities.map((entity) =>
        entity.kind === "player" ? { ...entity, name: "Renamed" } : entity,
      ),
    };
    expect(changesBetween(before, after).ids).toHaveLength(2);
    const large = {
      ...before,
      entities: Array.from({ length: 81 }, (_, i) => ({ ...before.entities[0], id: String(i) })),
    };
    expect(() => changesBetween(before, large)).toThrow("too many");
  });
});
