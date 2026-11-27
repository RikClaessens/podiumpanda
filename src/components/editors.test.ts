import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ofKind } from "../../shared/model";
import { fixture } from "../../shared/test-fixtures";
import { Setlist } from "./editors";

describe("setlist part assignments", () => {
  it("shows assigned players with their part and leaves unassigned parts unchanged", () => {
    const snapshot = fixture();
    const [alex, sam] = ofKind(snapshot, "player");
    const [violin1, violin2] = ofKind(snapshot, "part");
    snapshot.entities.push(
      { kind: "assignment", id: randomUUID(), partId: violin1.id, playerId: alex.id },
      { kind: "assignment", id: randomUUID(), partId: violin1.id, playerId: sam.id },
      {
        kind: "preference",
        id: randomUUID(),
        partId: violin2.id,
        playerId: alex.id,
        value: "favorite",
        note: "",
      },
    );

    const markup = renderToStaticMarkup(
      createElement(Setlist, {
        snapshot,
        busy: false,
        onEdit: async () => true,
        selectedPlayer: sam.id,
      }),
    );
    const pills = markup.match(/<div class="flex max-w-full[^"]*"[^>]*>.*?<\/div>/g) ?? [];
    expect(pills).toHaveLength(2);
    expect(pills[0]).toContain("Violin 1");
    expect(pills[0]).toContain("Alex");
    expect(pills[0]).toContain("Sam");
    expect(pills[0]).toContain(
      '<strong class="font-bold"><span><span>Alex</span></span><span>, <span class="underline decoration-coral decoration-2 underline-offset-2">Sam</span></span></strong>',
    );
    expect(pills[1]).toContain("Violin 2");
    expect(pills[1]).not.toContain("Alex");
    expect(pills[1]).not.toContain("Sam");
  });

  it("does not underline names when no player is selected", () => {
    const snapshot = fixture();
    const [player] = ofKind(snapshot, "player");
    const [part] = ofKind(snapshot, "part");
    snapshot.entities.push({
      kind: "assignment",
      id: randomUUID(),
      partId: part.id,
      playerId: player.id,
    });
    const markup = renderToStaticMarkup(
      createElement(Setlist, {
        snapshot,
        busy: false,
        onEdit: async () => true,
        selectedPlayer: "",
      }),
    );
    expect(markup).toContain(player.name);
    expect(markup).not.toContain("decoration-coral");
  });
});
