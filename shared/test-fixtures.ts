import { randomUUID } from "node:crypto";
import type { Entity, Snapshot } from "./model";

export function fixture(): Snapshot {
  const player: Entity = { kind: "player", id: randomUUID(), name: "Alex", instrument: "Violin" };
  const player2: Entity = { kind: "player", id: randomUUID(), name: "Sam", instrument: "Violin" };
  const floorplan: Entity = { kind: "floorplan", id: randomUUID(), name: "Main stage" };
  const entry: Entity = {
    kind: "entry",
    id: randomUUID(),
    title: "Overture",
    notes: "",
    order: 0,
    durationMinutes: 5,
    mediaUrl: "",
    floorplanId: floorplan.id,
  };
  const part: Entity = {
    kind: "part",
    id: randomUUID(),
    entryId: entry.id,
    name: "Violin 1",
    notes: "",
  };
  const part2: Entity = { ...part, id: randomUUID(), name: "Violin 2" };
  return {
    concert: {
      id: randomUUID(),
      title: "Summer concert",
      date: "",
      notes: "",
      defaultFloorplanId: floorplan.id,
      revision: 0,
      updatedAt: new Date().toISOString(),
    },
    entities: [player, player2, entry, part, part2, floorplan],
  };
}
