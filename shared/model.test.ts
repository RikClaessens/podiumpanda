import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  commandSchema,
  createGroupSchema,
  groupEditSchema,
  groupSchema,
  ofKind,
  snapshotSchema,
  type Entity,
} from "./model";
import { fixture } from "./test-fixtures";

describe("concert editing", () => {
  it("defaults older groups to the people icon and validates icon choices", () => {
    const group = { id: randomUUID(), name: "Orchestra", revision: 0, players: [], concertIds: [] };
    expect(groupSchema.parse(group).icon).toBe("users");
    expect(createGroupSchema.parse({ name: "Drummers", icon: "drum" }).icon).toBe("drum");
    expect(
      groupEditSchema.parse({ type: "icon", icon: "guitar", expectedRevision: 0 }),
    ).toMatchObject({
      icon: "guitar",
    });
    expect(createGroupSchema.safeParse({ name: "Group", icon: "unknown" }).success).toBe(false);
  });
  it.each(["square", "rectangle", "instrument"])(
    "saves and updates a %s floorplan object",
    (type) => {
      const snapshot = fixture();
      const object = {
        kind: "object",
        id: randomUUID(),
        floorplanId: snapshot.concert.defaultFloorplanId,
        type,
        label: "Marimba",
        playerId: null,
        partId: null,
        x: 100,
        y: 120,
        width: 180,
        height: 70,
        rotation: 20,
      };
      const command = commandSchema.parse({ type: "put", expectedRevision: 0, entity: object });
      const saved = applyCommand(snapshot, command);
      expect(snapshotSchema.parse(saved).entities).toContainEqual(object);
      const updated = applyCommand(
        saved,
        commandSchema.parse({
          type: "put",
          expectedRevision: 1,
          entity: { ...object, width: 220, rotation: -30 },
        }),
      );
      expect(snapshotSchema.parse(updated).entities).toContainEqual({
        ...object,
        width: 220,
        rotation: -30,
      });
    },
  );
  it("accepts favorite preferences without changing other players' existing preferences", () => {
    const snapshot = fixture();
    const [player, other, , part] = snapshot.entities;
    const existing = {
      kind: "preference" as const,
      id: randomUUID(),
      playerId: other.id,
      partId: part.id,
      value: "keen" as const,
      note: "Keep this note",
    };
    snapshot.entities.push(existing);
    const favorite = {
      kind: "preference",
      id: randomUUID(),
      playerId: player.id,
      partId: part.id,
      value: "favorite",
      note: "",
    };
    const result = applyCommand(
      snapshot,
      commandSchema.parse({ type: "put", expectedRevision: 0, entity: favorite }),
    );
    expect(snapshotSchema.parse(result).entities).toContainEqual(favorite);
    expect(result.entities).toContainEqual(existing);
  });
  it("accepts new players without instruments and retains legacy player data and assignments", () => {
    const original = fixture();
    const player = original.entities[0];
    const part = original.entities[3];
    if (player.kind !== "player" || part.kind !== "part") throw new Error("Fixture is invalid.");
    const assignment = {
      kind: "assignment",
      id: randomUUID(),
      playerId: player.id,
      partId: part.id,
    };
    const legacy = snapshotSchema.parse({
      ...original,
      entities: [...original.entities, assignment],
    });
    expect(legacy.entities.find((entity) => entity.id === player.id)).toMatchObject({
      instrument: player.instrument,
    });
    const { instrument: _legacyInstrument, ...newPlayer } = player;
    const updated = applyCommand(legacy, { type: "put", expectedRevision: 0, entity: newPlayer });
    expect(updated.entities.find((entity) => entity.id === player.id)).toEqual(newPlayer);
    expect(updated.entities.find((entity) => entity.id === assignment.id)).toEqual(assignment);
    expect(snapshotSchema.parse(updated)).toEqual(updated);
    expect(
      groupSchema.parse({
        id: randomUUID(),
        name: "Group",
        revision: 0,
        players: [player, { ...newPlayer, id: randomUUID() }],
        concertIds: [],
      }).players,
    ).toHaveLength(2);
  });

  it("allows the same player different parts in different pieces", () => {
    let snapshot = fixture();
    const [player, , entry] = snapshot.entities;
    if (entry.kind !== "entry") throw new Error("Fixture is invalid.");
    const secondEntry = { ...entry, id: randomUUID(), title: "Finale", order: 1 };
    const secondPart: Entity = {
      kind: "part",
      id: randomUUID(),
      entryId: secondEntry.id,
      name: "Percussion",
      notes: "",
    };
    snapshot = applyCommand(snapshot, { type: "put", expectedRevision: 0, entity: secondEntry });
    snapshot = applyCommand(snapshot, { type: "put", expectedRevision: 1, entity: secondPart });
    for (const partId of [snapshot.entities[3].id, secondPart.id]) {
      snapshot = applyCommand(snapshot, {
        type: "put",
        expectedRevision: snapshot.concert.revision,
        entity: { kind: "assignment", id: randomUUID(), playerId: player.id, partId },
      });
    }
    expect(
      ofKind(snapshot, "assignment")
        .filter((entity) => entity.playerId === player.id)
        .map((entity) => entity.partId),
    ).toEqual([snapshot.entities[3].id, secondPart.id]);
  });
  it("rejects edits to group players while allowing concert-specific guests", () => {
    const base = fixture();
    const player = base.entities[0];
    if (player.kind !== "player") throw new Error("Fixture is invalid.");
    const snapshot = { ...base, groupPlayerIds: [player.id], groupRevision: 4 };
    expect(() =>
      applyCommand(snapshot, {
        type: "put",
        expectedRevision: 0,
        entity: { ...player, name: "Changed" },
      }),
    ).toThrow("managed in the group");
    expect(() =>
      applyCommand(snapshot, { type: "delete", expectedRevision: 0, id: player.id }),
    ).toThrow("managed in the group");
    const guest = { ...player, id: randomUUID(), name: "Guest" };
    const result = applyCommand(snapshot, { type: "put", expectedRevision: 0, entity: guest });
    expect(result.entities).toContainEqual(guest);
    expect(result.groupRevision).toBe(4);
  });
  it("opens older pieces without media links and preserves a subsequently saved link", () => {
    const original = fixture();
    const snapshot = snapshotSchema.parse({
      ...original,
      entities: original.entities.map((entity) =>
        entity.kind === "entry" ? { ...entity, mediaUrl: undefined } : entity,
      ),
    });
    const entry = snapshot.entities.find((entity) => entity.kind === "entry");
    if (!entry) throw new Error("Fixture is missing a piece.");
    expect(entry.mediaUrl).toBe("");
    const mediaUrl = "https://youtu.be/M7lc1UVf-VE";
    const result = applyCommand(
      snapshot,
      commandSchema.parse({
        type: "put",
        expectedRevision: 0,
        entity: { ...entry, mediaUrl },
      }),
    );
    expect(result.entities.find((entity) => entity.id === entry.id)).toMatchObject({ mediaUrl });
  });

  it("supports multiple players per part and multiple parts per player independently of preferences", () => {
    let snapshot = fixture();
    const [player, player2, , part, part2] = snapshot.entities;
    const pref: Entity = {
      kind: "preference",
      id: randomUUID(),
      playerId: player.id,
      partId: part.id,
      value: "rather-not",
      note: "",
    };
    snapshot = applyCommand(snapshot, { type: "put", expectedRevision: 0, entity: pref });
    for (const [playerId, partId] of [
      [player.id, part.id],
      [player2.id, part.id],
      [player.id, part2.id],
    ]) {
      snapshot = applyCommand(snapshot, {
        type: "put",
        expectedRevision: snapshot.concert.revision,
        entity: { kind: "assignment", id: randomUUID(), playerId, partId },
      });
    }
    expect(snapshot.entities.filter((entity) => entity.kind === "assignment")).toHaveLength(3);
    expect(snapshot.entities.find((entity) => entity.id === pref.id)).toEqual(pref);
  });

  it("rejects stale edits and duplicate assignment pairs", () => {
    const snapshot = fixture();
    const [player, , , part] = snapshot.entities;
    const assignment: Entity = {
      kind: "assignment",
      id: randomUUID(),
      playerId: player.id,
      partId: part.id,
    };
    expect(() =>
      applyCommand(snapshot, { type: "put", expectedRevision: 1, entity: assignment }),
    ).toThrow("changed");
    const after = applyCommand(snapshot, { type: "put", expectedRevision: 0, entity: assignment });
    expect(() =>
      applyCommand(after, {
        type: "put",
        expectedRevision: 1,
        entity: { ...assignment, id: randomUUID() },
      }),
    ).toThrow("already");
  });

  it("deleting a piece removes its parts and allocations but preserves stage objects with cleared part references", () => {
    const snapshot = fixture();
    const [player, , entry, part, , floorplan] = snapshot.entities;
    snapshot.entities.push(
      { kind: "assignment", id: randomUUID(), playerId: player.id, partId: part.id },
      {
        kind: "preference",
        id: randomUUID(),
        playerId: player.id,
        partId: part.id,
        value: "keen",
        note: "",
      },
      {
        kind: "object",
        id: randomUUID(),
        floorplanId: floorplan.id,
        type: "chair",
        playerId: player.id,
        partId: part.id,
        label: "",
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        rotation: 0,
      },
    );
    const result = applyCommand(snapshot, { type: "delete", expectedRevision: 0, id: entry.id });
    expect(
      result.entities.some((entity) =>
        ["part", "assignment", "preference", "entry"].includes(entity.kind),
      ),
    ).toBe(false);
    expect(result.entities.find((entity) => entity.kind === "object")).toMatchObject({
      partId: null,
      playerId: player.id,
    });
    expect(snapshot.entities.some((entity) => entity.kind === "part")).toBe(true);
  });

  it("clears floorplan references and deletes its objects when a floorplan is deleted", () => {
    const snapshot = fixture();
    const floorplan = snapshot.entities[5];
    snapshot.entities.push({
      kind: "object",
      id: randomUUID(),
      floorplanId: floorplan.id,
      type: "stand",
      playerId: null,
      partId: null,
      label: "",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      rotation: 0,
    });
    const result = applyCommand(snapshot, {
      type: "delete",
      expectedRevision: 0,
      id: floorplan.id,
    });
    expect(result.concert.defaultFloorplanId).toBeNull();
    expect(result.entities.find((entity) => entity.kind === "entry")).toMatchObject({
      floorplanId: null,
    });
    expect(result.entities.some((entity) => entity.kind === "object")).toBe(false);
  });

  it("rejects dangling references and incomplete or duplicate reorder lists", () => {
    const snapshot = fixture();
    expect(() =>
      applyCommand(snapshot, {
        type: "put",
        expectedRevision: 0,
        entity: { kind: "part", id: randomUUID(), name: "Solo", notes: "", entryId: randomUUID() },
      }),
    ).toThrow("does not exist");
    expect(() =>
      applyCommand(snapshot, { type: "reorder", expectedRevision: 0, entryIds: [] }),
    ).toThrow("exactly once");
    expect(() =>
      applyCommand(snapshot, {
        type: "reorder",
        expectedRevision: 0,
        entryIds: [snapshot.entities[2].id, snapshot.entities[2].id],
      }),
    ).toThrow("exactly once");
  });

  it("reorders entries without changing their identities or part references", () => {
    const snapshot = fixture();
    const entry = snapshot.entities[2];
    if (entry.kind !== "entry") throw new Error("Fixture is invalid");
    const second: Entity = { ...entry, id: randomUUID(), order: 1, title: "Encore" };
    snapshot.entities.push(second);
    const result = applyCommand(snapshot, {
      type: "reorder",
      expectedRevision: 0,
      entryIds: [second.id, entry.id],
    });
    expect(result.entities.find((entity) => entity.id === entry.id)).toMatchObject({ order: 1 });
    expect(result.entities.find((entity) => entity.kind === "part")).toMatchObject({
      entryId: entry.id,
    });
  });

  it("validates floorplan coordinates and required names at the request seam", () => {
    expect(
      commandSchema.safeParse({
        type: "put",
        expectedRevision: 0,
        entity: { kind: "player", id: randomUUID(), name: " ", instrument: "" },
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "put",
        expectedRevision: 0,
        entity: {
          kind: "object",
          id: randomUUID(),
          floorplanId: randomUUID(),
          type: "chair",
          playerId: null,
          partId: null,
          label: "",
          x: -1,
          y: 0,
          width: 50,
          height: 50,
          rotation: 0,
        },
      }).success,
    ).toBe(false);
  });
});
