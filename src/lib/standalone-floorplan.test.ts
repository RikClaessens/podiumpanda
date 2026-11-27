import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ofKind } from "../../shared/model";
import { fixture } from "../../shared/test-fixtures";
import {
  createStandaloneFloorplanSnapshot,
  floorplanEditsForConcert,
  floorplanEditsForStandalone,
  parseLocalFloorplanState,
} from "./standalone-floorplan";

describe("standalone floorplan export", () => {
  it("copies a plan and its objects with fresh IDs and destination-safe references", () => {
    const source = fixture();
    const [plan] = ofKind(source, "floorplan");
    const [player] = ofKind(source, "player");
    const [part] = ofKind(source, "part");
    const objectId = randomUUID();
    source.entities.push({
      kind: "object",
      id: objectId,
      floorplanId: plan.id,
      type: "chair",
      label: "Concertmaster",
      playerId: player.id,
      partId: part.id,
      x: 120,
      y: 140,
      width: 50,
      height: 50,
      rotation: 15,
    });
    const destination = fixture();
    const destinationPlayer = ofKind(destination, "player")[0];
    destinationPlayer.id = player.id;
    const ids = [randomUUID(), randomUUID()];
    const [newPlanId, newObjectId] = ids;
    const edits = floorplanEditsForConcert(source, plan.id, destination, () => ids.shift()!);

    expect(edits).toHaveLength(2);
    expect(edits[0]).toMatchObject({
      type: "put",
      entity: { kind: "floorplan", id: newPlanId, name: plan.name },
    });
    expect(edits[1]).toMatchObject({
      type: "put",
      entity: {
        kind: "object",
        id: newObjectId,
        floorplanId: newPlanId,
        playerId: player.id,
        partId: null,
        label: "Concertmaster",
        x: 120,
        y: 140,
        rotation: 15,
      },
    });
  });

  it("copies empty plans and rejects a missing source plan", () => {
    const source = fixture();
    const destination = fixture();
    const [plan] = ofKind(source, "floorplan");
    expect(floorplanEditsForConcert(source, plan.id, destination, () => "new-plan")).toEqual([
      { type: "put", entity: { kind: "floorplan", id: "new-plan", name: plan.name } },
    ]);
    expect(() => floorplanEditsForConcert(source, randomUUID(), destination)).toThrow(
      "The floorplan could not be found.",
    );
  });

  it("loads a concert floorplan into a draft without replacing its plans or stale references", () => {
    const source = fixture();
    const [plan] = ofKind(source, "floorplan");
    const [player] = ofKind(source, "player");
    const [part] = ofKind(source, "part");
    source.entities.push({
      kind: "object",
      id: randomUUID(),
      floorplanId: plan.id,
      type: "chair",
      label: "Concertmaster",
      playerId: player.id,
      partId: part.id,
      x: 120,
      y: 140,
      width: 50,
      height: 50,
      rotation: 15,
    });
    const existingDraftPlan = { kind: "floorplan" as const, id: randomUUID(), name: "Existing" };
    const destination = createStandaloneFloorplanSnapshot();
    destination.entities.push(existingDraftPlan);
    const ids = [randomUUID(), randomUUID()];
    const [newPlanId, newObjectId] = ids;

    const imported = floorplanEditsForStandalone(source, plan.id, () => ids.shift()!);

    expect(imported.floorplanId).toBe(newPlanId);
    expect(imported.edits).toHaveLength(2);
    expect(imported.edits[0]).toMatchObject({
      type: "put",
      entity: { kind: "floorplan", id: newPlanId, name: plan.name },
    });
    expect(imported.edits[1]).toMatchObject({
      type: "put",
      entity: {
        kind: "object",
        id: newObjectId,
        floorplanId: newPlanId,
        playerId: null,
        partId: null,
        x: 120,
        y: 140,
        rotation: 15,
      },
    });
    expect(destination.entities).toEqual([existingDraftPlan]);
  });

  it("creates and validates a local draft snapshot", () => {
    const snapshot = createStandaloneFloorplanSnapshot(() => randomUUID());
    expect(snapshot.concert.title).toBe("My stage plan");
    expect(parseLocalFloorplanState({ snapshot })).toEqual({
      snapshot,
      hasSavedDraft: true,
    });
    expect(() => parseLocalFloorplanState({ snapshot: {} })).toThrow(
      "The saved floorplan draft is unreadable.",
    );
  });
});
