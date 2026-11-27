import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { GroupCards } from "./group-cards";
import type { RecentGroup } from "../lib/local";

describe("group cards", () => {
  it("renders all saved groups with their sharing keys and a create link", async () => {
    const groups: RecentGroup[] = Array.from({ length: 4 }, (_, index) => ({
      id: `123e4567-e89b-42d3-a456-42661417400${index}`,
      title: `Group ${index + 1}`,
      key: `key${index}`,
      visitedAt: "2026-01-01",
      icon: "users",
    }));
    const root = createRootRoute({ component: () => createElement(GroupCards, { groups }) });
    const routeTree = root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/g/$groupId" }),
      createRoute({ getParentRoute: () => root, path: "/g/new" }),
    ]);
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
    for (const [index, group] of groups.entries()) {
      expect(markup).toContain(group.title);
      expect(markup).toContain(`/g/${group.id}#key=key${index}`);
    }
    expect(markup).toContain('href="/g/new"');
  });
});
