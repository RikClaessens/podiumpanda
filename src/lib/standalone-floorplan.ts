import { z } from "zod";
import { ofKind, snapshotSchema, type Edit, type Snapshot } from "../../shared/model";

export const STANDALONE_FLOORPLAN_STORAGE_KEY = "podiumpanda.floorplan.draft.v1";

function copiedFloorplan(
  source: Snapshot,
  floorplanId: string,
  destination: Snapshot | undefined,
  createId: () => string,
) {
  const plan = ofKind(source, "floorplan").find((item) => item.id === floorplanId);
  if (!plan) throw new Error("The floorplan could not be found.");

  const newFloorplanId = createId();
  const players = new Set(
    destination ? ofKind(destination, "player").map((player) => player.id) : [],
  );
  const parts = new Set(destination ? ofKind(destination, "part").map((part) => part.id) : []);
  const edits: Edit[] = [
    { type: "put", entity: { kind: "floorplan", id: newFloorplanId, name: plan.name } },
  ];
  for (const object of ofKind(source, "object").filter((item) => item.floorplanId === plan.id)) {
    edits.push({
      type: "put",
      entity: {
        ...object,
        id: createId(),
        floorplanId: newFloorplanId,
        playerId: object.playerId && players.has(object.playerId) ? object.playerId : null,
        partId: object.partId && parts.has(object.partId) ? object.partId : null,
      },
    });
  }
  return { floorplanId: newFloorplanId, edits };
}

export function floorplanEditsForConcert(
  source: Snapshot,
  floorplanId: string,
  destination: Snapshot,
  createId: () => string = () => crypto.randomUUID(),
): Edit[] {
  return copiedFloorplan(source, floorplanId, destination, createId).edits;
}

export function floorplanEditsForStandalone(
  source: Snapshot,
  floorplanId: string,
  createId: () => string = () => crypto.randomUUID(),
) {
  return copiedFloorplan(source, floorplanId, undefined, createId);
}

export function createStandaloneFloorplanSnapshot(
  createId: () => string = () => crypto.randomUUID(),
): Snapshot {
  return {
    concert: {
      id: createId(),
      title: "My stage plan",
      date: "",
      notes: "",
      defaultFloorplanId: null,
      revision: 0,
      updatedAt: new Date().toISOString(),
    },
    entities: [],
  };
}

export type LocalFloorplanState = {
  snapshot: Snapshot;
  hasSavedDraft: boolean;
};

export function parseLocalFloorplanState(value: unknown): LocalFloorplanState {
  const parsed = z.object({ snapshot: snapshotSchema }).safeParse(value);
  if (!parsed.success) throw new Error("The saved floorplan draft is unreadable.");
  return { snapshot: parsed.data.snapshot, hasSavedDraft: true };
}
