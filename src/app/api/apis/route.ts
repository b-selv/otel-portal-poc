import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createApiSchema } from "@/lib/api-schema";
import { ddb, tableName } from "@/lib/dynamodb";
import { inSpan } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return await inSpan("portal.api.list", { "app.user.id": user.sub, "db.system": "dynamodb" }, async () => {
      const result = await ddb.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: "createdBy = :user",
        ExpressionAttributeValues: { ":user": user.sub }
      }));
      return NextResponse.json({ items: result.Items ?? [] });
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    if (!unauthorized) console.error(JSON.stringify({ event: "portal.api.list.error", "error.type": error instanceof Error ? error.constructor.name : "UnknownError", "error.message": error instanceof Error ? error.message : String(error), "db.system": "dynamodb" }));
    return NextResponse.json({ error: unauthorized ? "Unauthorized" : "Unable to list APIs" }, { status: unauthorized ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  let apiPayload: { name?: string; basePath?: string; backendUrl?: string } = {};
  try {
    const user = await requireUser(request);
    return await inSpan("portal.api.create", { "app.user.id": user.sub }, async () => {
      const raw = await request.json();
      const parsed = createApiSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid API configuration", details: parsed.error.issues }, { status: 400 });
      }

      apiPayload = { name: parsed.data.name, basePath: parsed.data.basePath, backendUrl: parsed.data.backendUrl };

      return await inSpan("portal.api.validate", { "app.api.base_path": parsed.data.basePath, "db.system": "dynamodb" }, async () => {
        const scan = await ddb.send(new ScanCommand({
          TableName: tableName,
          FilterExpression: "basePath = :path",
          ExpressionAttributeValues: { ":path": parsed.data.basePath }
        }));
        if ((scan.Items ?? []).length > 0) {
          return NextResponse.json({ error: "Base path already exists" }, { status: 409 });
        }

        const now = new Date().toISOString();
        const item = {
          apiId: randomUUID(),
          ...parsed.data,
          status: "DRAFT",
          createdBy: user.sub,
          createdAt: now,
          updatedAt: now
        };

        await inSpan("portal.api.save", { "db.system": "dynamodb", "app.api.id": item.apiId }, async () => {
          await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
        });

        return NextResponse.json({ item }, { status: 201 });
      });
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    if (!unauthorized) console.error(JSON.stringify({ event: "portal.api.create.error", "error.type": error instanceof Error ? error.constructor.name : "UnknownError", "error.message": error instanceof Error ? error.message : String(error), "db.system": "dynamodb", ...apiPayload }));
    return NextResponse.json({ error: unauthorized ? "Unauthorized" : "Unable to create API" }, { status: unauthorized ? 401 : 500 });
  }
}
