import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Opening } from "./lib/language";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: Opening,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
