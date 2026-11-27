import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createHandler } from "./handler";
import { HttpError } from "./store";
import { fixture } from "../shared/test-fixtures";

function event(
  method: string,
  path: string,
  body?: string,
  token?: string,
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "test",
      domainPrefix: "test",
      requestId: "test",
      routeKey: "$default",
      stage: "$default",
      time: "",
      timeEpoch: 0,
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
    },
    body,
    isBase64Encoded: false,
  };
}

function store() {
  return {
    create: vi.fn().mockResolvedValue({ id: randomUUID(), key: "a".repeat(43) }),
    read: vi.fn().mockResolvedValue(fixture()),
    edit: vi.fn().mockResolvedValue(fixture()),
    history: vi.fn().mockResolvedValue([]),
    undo: vi.fn().mockResolvedValue(fixture()),
    createGroup: vi.fn().mockResolvedValue({ id: randomUUID(), key: "a".repeat(43) }),
    readGroup: vi.fn(),
    editGroup: vi.fn(),
    createGroupConcert: vi.fn(),
  };
}

describe("HTTP concert interface", () => {
  it("accepts a combined group details edit and rejects invalid icon choices", async () => {
    const db = store();
    db.editGroup.mockResolvedValue({});
    const handler = createHandler(db);
    const id = randomUUID();
    const token = "a".repeat(43);
    const details = { type: "details", name: "New", icon: "drum", expectedRevision: 3 };
    expect(
      (await handler(event("PATCH", `/api/groups/${id}`, JSON.stringify(details), token)))
        .statusCode,
    ).toBe(200);
    expect(db.editGroup).toHaveBeenCalledWith(id, token, details);
    expect(
      (
        await handler(
          event(
            "PATCH",
            `/api/groups/${id}`,
            JSON.stringify({ ...details, icon: "invalid" }),
            token,
          ),
        )
      ).statusCode,
    ).toBe(400);
    expect(db.editGroup).toHaveBeenCalledTimes(1);
  });
  it("accepts group icon selections on creation and editing and rejects unknown icons", async () => {
    const db = store();
    db.editGroup.mockResolvedValue({});
    const handler = createHandler(db);
    const id = randomUUID();
    const token = "a".repeat(43);
    expect(
      (
        await handler(
          event("POST", "/api/groups", JSON.stringify({ name: "Percussion", icon: "drum" })),
        )
      ).statusCode,
    ).toBe(201);
    expect(db.createGroup).toHaveBeenCalledWith({ name: "Percussion", icon: "drum" });
    expect(
      (
        await handler(
          event(
            "PATCH",
            `/api/groups/${id}`,
            JSON.stringify({ type: "icon", icon: "guitar", expectedRevision: 0 }),
            token,
          ),
        )
      ).statusCode,
    ).toBe(200);
    expect(db.editGroup).toHaveBeenCalledWith(id, token, {
      type: "icon",
      icon: "guitar",
      expectedRevision: 0,
    });
    expect(
      (
        await handler(
          event("POST", "/api/groups", JSON.stringify({ name: "Bad", icon: "unknown" })),
        )
      ).statusCode,
    ).toBe(400);
  });
  it.each(["square", "rectangle", "instrument"])(
    "accepts a %s floorplan object through the concert edit endpoint",
    async (type) => {
      const db = store();
      const id = randomUUID();
      const entity = {
        kind: "object",
        id: randomUUID(),
        floorplanId: randomUUID(),
        type,
        label: "",
        playerId: null,
        partId: null,
        x: 100,
        y: 120,
        width: 180,
        height: 70,
        rotation: 0,
      };
      const result = await createHandler(db)(
        event(
          "PATCH",
          `/api/concerts/${id}`,
          JSON.stringify({ type: "put", expectedRevision: 0, entity }),
          "a".repeat(43),
        ),
      );
      expect(result.statusCode).toBe(200);
      expect(db.edit).toHaveBeenCalledWith(
        id,
        "a".repeat(43),
        expect.objectContaining({ type: "put", entity }),
      );
    },
  );
  it("accepts the favorite preference through the concert edit endpoint", async () => {
    const db = store();
    const id = randomUUID();
    const entity = {
      kind: "preference",
      id: randomUUID(),
      playerId: randomUUID(),
      partId: randomUUID(),
      value: "favorite",
      note: "",
    };
    const result = await createHandler(db)(
      event(
        "PATCH",
        `/api/concerts/${id}`,
        JSON.stringify({ type: "put", expectedRevision: 0, entity }),
        "a".repeat(43),
      ),
    );
    expect(result.statusCode).toBe(200);
    expect(db.edit).toHaveBeenCalledWith(
      id,
      "a".repeat(43),
      expect.objectContaining({ type: "put", entity }),
    );
  });
  it("creates groups and requires their key for roster and concert operations", async () => {
    const db = store();
    const handler = createHandler(db);
    const id = randomUUID();
    expect(
      (await handler(event("POST", "/api/groups", JSON.stringify({ name: "Orchestra" }))))
        .statusCode,
    ).toBe(201);
    expect(
      (await handler(event("POST", "/api/groups", JSON.stringify({ name: "" })))).statusCode,
    ).toBe(400);
    for (const [method, suffix] of [
      ["GET", ""],
      ["PATCH", ""],
      ["POST", "/concerts"],
    ]) {
      expect((await handler(event(method, `/api/groups/${id}${suffix}`, "{}"))).statusCode).toBe(
        401,
      );
    }
    db.createGroupConcert.mockResolvedValue({ id: randomUUID() });
    expect(
      (
        await handler(
          event(
            "POST",
            `/api/groups/${id}/concerts`,
            JSON.stringify({ title: "Concert", date: "" }),
            "a".repeat(43),
          ),
        )
      ).statusCode,
    ).toBe(201);
    expect(db.createGroupConcert).toHaveBeenCalledWith(
      id,
      "a".repeat(43),
      expect.objectContaining({ title: "Concert" }),
    );
  });
  it("creates without a login but validates the request before storing it", async () => {
    const db = store();
    const handler = createHandler(db);
    expect(
      (await handler(event("POST", "/api/concerts", '{"title":"Evening","date":""}'))).statusCode,
    ).toBe(201);
    expect((await handler(event("POST", "/api/concerts", '{"title":""}'))).statusCode).toBe(400);
    expect((await handler(event("POST", "/api/concerts", "{bad"))).statusCode).toBe(400);
    expect(db.create).toHaveBeenCalledTimes(1);
  });
  it("requires a key for reads, edits, history and undo", async () => {
    const db = store();
    const handler = createHandler(db);
    const id = randomUUID();
    for (const [method, suffix] of [
      ["GET", ""],
      ["PATCH", ""],
      ["GET", "/history"],
      ["POST", "/undo"],
    ]) {
      expect((await handler(event(method, `/api/concerts/${id}${suffix}`, "{}"))).statusCode).toBe(
        401,
      );
    }
    expect(db.read).not.toHaveBeenCalled();
    expect(db.edit).not.toHaveBeenCalled();
  });
  it("propagates invalid keys without exposing concert data", async () => {
    const db = store();
    db.read.mockRejectedValue(
      new HttpError(404, "Concert not found or the sharing key is invalid."),
    );
    const result = await createHandler(db)(
      event("GET", `/api/concerts/${randomUUID()}`, undefined, "b".repeat(43)),
    );
    expect(result.statusCode).toBe(404);
    expect(result.body).not.toContain("Summer concert");
  });
  it("reports conditional write conflicts rather than success", async () => {
    const db = store();
    db.edit.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        name: "TransactionCanceledException",
        CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
      }),
    );
    const result = await createHandler(db)(
      event(
        "PATCH",
        `/api/concerts/${randomUUID()}`,
        JSON.stringify({
          type: "put",
          expectedRevision: 0,
          entity: { kind: "player", id: randomUUID(), name: "Alex", instrument: "" },
        }),
        "b".repeat(43),
      ),
    );
    expect(result.statusCode).toBe(409);
    expect(result.headers?.["cache-control"]).toBe("no-store");
  });
});
