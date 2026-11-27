import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { z } from "zod";
import {
  commandSchema,
  createConcertSchema,
  createGroupSchema,
  groupEditSchema,
  DomainError,
} from "../shared/model.ts";
import { ConcertStore, HttpError } from "./store.ts";

type Store = Pick<
  ConcertStore,
  | "create"
  | "read"
  | "edit"
  | "history"
  | "undo"
  | "createGroup"
  | "readGroup"
  | "editGroup"
  | "createGroupConcert"
>;
const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

function bodyOf(event: APIGatewayProxyEventV2): unknown {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");
  if (Buffer.byteLength(body) > 64_000) throw new HttpError(413, "Request is too large.");
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Request must contain valid JSON.");
  }
}

export function createHandler(store: Store) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      const method = event.requestContext.http.method;
      if (method === "POST" && event.rawPath === "/api/groups") {
        return json(201, await store.createGroup(createGroupSchema.parse(bodyOf(event))));
      }
      if (method === "POST" && event.rawPath === "/api/concerts") {
        return json(201, await store.create(createConcertSchema.parse(bodyOf(event))));
      }
      const groupMatch = /^\/api\/groups\/([^/]+)(?:\/(concerts))?$/.exec(event.rawPath);
      const match = /^\/api\/concerts\/([^/]+)(?:\/(history|undo))?$/.exec(event.rawPath);
      if (!match && !groupMatch) return json(404, { error: "Route not found." });
      const id = z.uuid().parse((groupMatch ?? match)![1]);
      const authorization = event.headers.authorization;
      if (!authorization?.startsWith("Bearer "))
        throw new HttpError(401, "A sharing key is required.");
      const token = authorization.slice(7);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token))
        throw new HttpError(401, "The sharing key is malformed.");
      if (groupMatch) {
        if (method === "GET" && !groupMatch[2]) return json(200, await store.readGroup(id, token));
        if (method === "PATCH" && !groupMatch[2])
          return json(200, await store.editGroup(id, token, groupEditSchema.parse(bodyOf(event))));
        if (method === "POST" && groupMatch[2] === "concerts")
          return json(
            201,
            await store.createGroupConcert(id, token, createConcertSchema.parse(bodyOf(event))),
          );
        return json(405, { error: "Method not allowed." });
      }
      if (!match) return json(404, { error: "Route not found." });
      if (method === "GET" && match[2] === "history")
        return json(200, await store.history(id, token));
      if (method === "POST" && match[2] === "undo") {
        const input = z
          .object({ expectedRevision: z.number().int().nonnegative() })
          .parse(bodyOf(event));
        return json(200, await store.undo(id, token, input.expectedRevision));
      }
      if (method === "GET" && !match[2]) return json(200, await store.read(id, token));
      if (method === "PATCH" && !match[2])
        return json(200, await store.edit(id, token, commandSchema.parse(bodyOf(event))));
      return json(405, { error: "Method not allowed." });
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.message });
      if (error instanceof z.ZodError)
        return json(400, {
          error: "Invalid input.",
          details: error.issues.map((issue) => issue.message),
        });
      if (error instanceof DomainError) return json(409, { error: error.message });
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException" &&
        "CancellationReasons" in error &&
        Array.isArray(error.CancellationReasons) &&
        error.CancellationReasons.some(
          (reason: { Code?: string }) => reason.Code === "ConditionalCheckFailed",
        )
      ) {
        return json(409, { error: "Someone else saved an edit first. Refresh and try again." });
      }
      console.error("Concert request failed", {
        requestId: event.requestContext.requestId,
        error: error instanceof Error ? error.name : "UnknownError",
      });
      return json(500, { error: "The concert could not be saved or loaded. Please try again." });
    }
  };
}

let store: ConcertStore | undefined;
export async function handler(event: APIGatewayProxyEventV2) {
  const table = process.env.TABLE_NAME;
  if (!table) throw new Error("TABLE_NAME must be configured.");
  store ??= new ConcertStore(table);
  return createHandler(store)(event);
}
