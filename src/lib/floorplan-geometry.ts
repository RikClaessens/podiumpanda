import type { OfKind } from "../../shared/model";

type StageObject = OfKind<"object">;

// The default view (0,0)-(1000,600) is the centre of a 3x3 grid of such views.
export const worldBounds = { minX: -1000, maxX: 2000, minY: -600, maxY: 1150 };
export const worldRect = { x: -1000, y: -600, width: 3000, height: 1800 };
export const minZoom = 1 / 3;
export const maxZoom = 4;
export const defaultView = { zoom: 1, cx: 500, cy: 300 };

export function clampView(view: { zoom: number; cx: number; cy: number }) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const zoom = clamp(view.zoom, minZoom, maxZoom);
  const halfW = 500 / zoom;
  const halfH = 300 / zoom;
  return {
    zoom,
    cx: clamp(view.cx, worldRect.x + halfW, worldRect.x + worldRect.width - halfW),
    cy: clamp(view.cy, worldRect.y + halfH, worldRect.y + worldRect.height - halfH),
  };
}

export function transformFloorObject(
  object: StageObject,
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number },
): StageObject {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    ...object,
    x: clamp(transform.x, worldBounds.minX, worldBounds.maxX),
    y: clamp(transform.y, worldBounds.minY, worldBounds.maxY),
    width: clamp(object.width * transform.scaleX, 10, 500),
    height: clamp(object.height * transform.scaleY, 10, 500),
    rotation: ((transform.rotation % 360) + 360) % 360,
  };
}
