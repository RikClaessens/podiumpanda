import { z } from "zod";
import {
  groupSnapshotSchema,
  snapshotSchema,
  type Edit,
  type GroupEdit,
  type GroupIcon,
  type Snapshot,
} from "../../shared/model";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(
  path: string,
  key: string | null,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`/api/concerts${path}`, {
    method,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const result = z.object({ error: z.string() }).safeParse(data);
    throw new ApiError(response.status, result.success ? result.data.error : "The request failed.");
  }
  return data;
}
async function groupRequest(
  path: string,
  key: string | null,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`/api/groups${path}`, {
    method,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const result = z.object({ error: z.string() }).safeParse(data);
    throw new ApiError(response.status, result.success ? result.data.error : "The request failed.");
  }
  return data;
}
export async function createGroup(name: string, icon: GroupIcon) {
  return z
    .object({ id: z.uuid(), key: z.string() })
    .parse(await groupRequest("", null, "POST", { name, icon }));
}
export async function getGroup(id: string, key: string) {
  return groupSnapshotSchema.parse(await groupRequest(`/${id}`, key));
}
export async function editGroup(id: string, key: string, edit: GroupEdit) {
  return groupSnapshotSchema.parse(await groupRequest(`/${id}`, key, "PATCH", edit));
}
export async function createGroupConcert(
  id: string,
  key: string,
  title: string,
  date: string,
  floorplanName: string,
) {
  return z
    .object({ id: z.uuid() })
    .parse(await groupRequest(`/${id}/concerts`, key, "POST", { title, date, floorplanName }));
}
export async function createConcert(title: string, date: string, floorplanName = "Main stage") {
  return z
    .object({ id: z.uuid(), key: z.string() })
    .parse(await request("", null, "POST", { title, date, floorplanName }));
}
export async function getConcert(id: string, key: string) {
  return snapshotSchema.parse(await request(`/${id}`, key));
}
export async function editConcert(id: string, key: string, snapshot: Snapshot, edit: Edit) {
  return snapshotSchema.parse(
    await request(`/${id}`, key, "PATCH", {
      ...edit,
      expectedRevision: snapshot.concert.revision,
    }),
  );
}
export async function undoConcert(id: string, key: string, revision: number) {
  return snapshotSchema.parse(
    await request(`/${id}/undo`, key, "POST", { expectedRevision: revision }),
  );
}
export async function getHistory(id: string, key: string) {
  return z
    .array(
      z.object({
        revision: z.number(),
        at: z.string(),
        description: z.string(),
      }),
    )
    .parse(await request(`/${id}/history`, key));
}
