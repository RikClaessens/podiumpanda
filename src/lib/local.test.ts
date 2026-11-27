import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recentGroups, rememberGroup } from "./local";

afterEach(() => vi.unstubAllGlobals());

describe("group shortcuts", () => {
  it("reads legacy shortcuts and preserves selected icons when revisiting groups", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    });
    const legacy = { id: randomUUID(), key: "key", title: "Group", visitedAt: "yesterday" };
    data.set("podiumpanda.groups.v1", JSON.stringify([legacy]));
    expect(recentGroups()).toEqual([{ ...legacy, icon: "users" }]);
    rememberGroup({ ...legacy, icon: "drum", visitedAt: "today" });
    expect(recentGroups()).toEqual([{ ...legacy, icon: "drum", visitedAt: "today" }]);
  });
});
