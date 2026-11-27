import { z } from "zod";
import { groupIconSchema } from "../../shared/model";

const shortcutSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  title: z.string(),
  visitedAt: z.string(),
});
const recentSchema = z.array(shortcutSchema);
const recentGroupSchema = z.array(
  shortcutSchema.extend({ icon: groupIconSchema.default("users") }),
);
export type Recent = z.infer<typeof recentSchema>[number];
export type RecentGroup = z.infer<typeof recentGroupSchema>[number];
const storageKey = "podiumpanda.recents.v1";
const groupStorageKey = "podiumpanda.groups.v1";

export function recentGroups(): RecentGroup[] {
  const raw = localStorage.getItem(groupStorageKey);
  if (!raw) return [];
  const parsed = recentGroupSchema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error(
      "Saved group shortcuts are unreadable. Browser storage can be cleared to reset them.",
    );
  return parsed.data;
}
export function rememberGroup(group: RecentGroup) {
  localStorage.setItem(
    groupStorageKey,
    JSON.stringify([group, ...recentGroups().filter((item) => item.id !== group.id)].slice(0, 50)),
  );
}
export function forgetGroup(id: string) {
  localStorage.setItem(
    groupStorageKey,
    JSON.stringify(recentGroups().filter((item) => item.id !== id)),
  );
}
export function groupSharingLink(id: string, key: string) {
  return `${window.location.origin}/g/${id}#key=${key}`;
}
export function readGroupKey(id: string) {
  return (
    new URLSearchParams(window.location.hash.slice(1)).get("key") ??
    recentGroups().find((group) => group.id === id)?.key ??
    null
  );
}

export function recents(): Recent[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  const result = recentSchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "Saved concert shortcuts are unreadable. Browser storage can be cleared to reset them.",
    );
  return result.data;
}
export function remember(recent: Recent) {
  localStorage.setItem(
    storageKey,
    JSON.stringify([recent, ...recents().filter((item) => item.id !== recent.id)].slice(0, 50)),
  );
}
export function forget(id: string) {
  localStorage.setItem(storageKey, JSON.stringify(recents().filter((item) => item.id !== id)));
}
export function sharingLink(id: string, key: string) {
  return `${window.location.origin}/c/${id}#key=${key}`;
}
export function readKey(id: string) {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get("key");
  return fragment ?? recents().find((recent) => recent.id === id)?.key ?? null;
}
