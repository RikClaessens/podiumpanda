import { describe, expect, it } from "vitest";
import { entitySchema } from "../../shared/model";
import { transformFloorObject } from "./floorplan-geometry";

describe("floorplan object transforms", () => {
  it("persists resized and rotated geometry without losing legacy references or labels", () => {
    const object = entitySchema.parse({
      kind: "object",
      id: "11111111-1111-4111-8111-111111111111",
      floorplanId: "22222222-2222-4222-8222-222222222222",
      type: "instrument",
      x: 100,
      y: 120,
      width: 180,
      height: 70,
      rotation: 0,
      label: "Marimba",
      playerId: "33333333-3333-4333-8333-333333333333",
      partId: "44444444-4444-4444-8444-444444444444",
    });
    if (object.kind !== "object") throw new Error("Invalid fixture");
    const result = transformFloorObject(object, {
      x: 80,
      y: 110,
      scaleX: 1.5,
      scaleY: 2,
      rotation: -45,
    });
    expect(result).toMatchObject({
      x: 80,
      y: 110,
      width: 270,
      height: 140,
      rotation: 315,
      label: object.label,
      playerId: object.playerId,
      partId: object.partId,
    });
    expect(entitySchema.parse(result)).toEqual(result);
  });

  it("keeps resized objects within the stored geometry limits", () => {
    const object = entitySchema.parse({
      kind: "object",
      id: "11111111-1111-4111-8111-111111111111",
      floorplanId: "22222222-2222-4222-8222-222222222222",
      type: "square",
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      rotation: 0,
      label: "",
      playerId: null,
      partId: null,
    });
    if (object.kind !== "object") throw new Error("Invalid fixture");
    const result = transformFloorObject(object, {
      x: -3000,
      y: 2000,
      scaleX: 0.01,
      scaleY: 30,
      rotation: 730,
    });
    expect(result).toMatchObject({ x: -1000, y: 1150, width: 10, height: 500, rotation: 10 });
    expect(entitySchema.parse(result)).toEqual(result);
  });
});
