import type { OfKind } from "../../shared/model";

type StageObject = OfKind<"object">;

export function transformFloorObject(
  object: StageObject,
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number },
): StageObject {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    ...object,
    x: clamp(transform.x, 0, 1000),
    y: clamp(transform.y, 0, 550),
    width: clamp(object.width * transform.scaleX, 10, 500),
    height: clamp(object.height * transform.scaleY, 10, 500),
    rotation: ((transform.rotation % 360) + 360) % 360,
  };
}
