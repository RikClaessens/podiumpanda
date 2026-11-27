import { z } from "zod";

export const WHEEL_STORAGE_KEY = "podiumpanda.wheel-of-fortune.v1";

export const wheelStateSchema = z
  .object({
    entries: z.string(),
    selectedIndex: z.number().int().nonnegative().nullable(),
    muted: z.boolean().default(false),
  })
  .refine(
    (state) =>
      state.selectedIndex === null || state.selectedIndex < wheelEntries(state.entries).length,
  );

export type WheelState = z.infer<typeof wheelStateSchema>;

export function wheelEntries(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function wheelRotationForIndex(index: number, count: number): number {
  return (-index * 360) / count;
}

export function randomWheelIndex(count: number): number {
  return Math.floor(Math.random() * count);
}

export function wheelBoundaryIndex(rotation: number, count: number): number {
  const step = 360 / count;
  return Math.floor((rotation + step / 2) / step);
}

export function nextWheelRotation(current: number, index: number, count: number): number {
  const target = wheelRotationForIndex(index, count);
  return current + 7 * 360 + ((((target - current) % 360) + 360) % 360);
}

export function wheelSlicePath(index: number, count: number): string {
  if (count === 1) return "M 200 32 A 168 168 0 1 1 200 368 A 168 168 0 1 1 200 32 Z";
  const step = (2 * Math.PI) / count;
  const start = -Math.PI / 2 + (index - 0.5) * step;
  const end = start + step;
  const x = (angle: number) => 200 + 168 * Math.cos(angle);
  const y = (angle: number) => 200 + 168 * Math.sin(angle);
  return `M 200 200 L ${x(start)} ${y(start)} A 168 168 0 0 1 ${x(end)} ${y(end)} Z`;
}
