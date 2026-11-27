import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Route } from "../routes/c.$concertId";

describe("concert tab search", () => {
  const search = Route.options.validateSearch;
  if (!(search instanceof z.ZodType)) throw new Error("Concert search schema is missing");

  it("accepts tab links while leaving old links unchanged", () => {
    expect(search.parse({ tab: "preferences" })).toEqual({ tab: "preferences" });
    expect(search.parse({ tab: "history" })).toEqual({ tab: "history" });
    expect(search.parse({})).toEqual({});
  });

  it("falls back to the default tab for invalid search values", () => {
    expect(search.parse({ tab: "unknown" })).toEqual({ tab: undefined });
    expect(search.parse({ tab: 42 })).toEqual({ tab: undefined });
  });
});
