import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ddb, tableName } from "@/lib/dynamodb";
import { inSpan } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ apiId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { apiId } = await context.params;

    return await inSpan("portal.api.publish", { "app.user.id": user.sub, "app.api.id": apiId }, async () => {
      const existing = await inSpan("portal.api.load_for_publish", { "db.system": "dynamodb" }, async () => {
        const result = await ddb.send(new GetCommand({
          TableName: tableName,
          Key: { apiId }
        }));
        return result.Item;
      });

      if (!existing || existing.createdBy !== user.sub) {
        return NextResponse.json({ error: "API not found" }, { status: 404 });
      }
      if (existing.status === "PUBLISHED") {
        return NextResponse.json({ error: "API is already published" }, { status: 409 });
      }

      await inSpan("portal.api.validate_for_publish", { "app.api.base_path": String(existing.basePath) }, async () => {
        if (!existing.name || !existing.basePath || !existing.backendUrl) {
          throw new Error("API configuration is incomplete");
        }
        const url = new URL(String(existing.backendUrl));
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid backend URL protocol");
      });

      const publishedAt = new Date().toISOString();
      const result = await inSpan("portal.api.persist_publication", { "db.system": "dynamodb" }, async () => {
        return ddb.send(new UpdateCommand({
          TableName: tableName,
          Key: { apiId },
          UpdateExpression: "SET #status = :published, publishedAt = :publishedAt, updatedAt = :updatedAt",
          ConditionExpression: "createdBy = :user AND #status = :draft",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":published": "PUBLISHED",
            ":draft": "DRAFT",
            ":user": user.sub,
            ":publishedAt": publishedAt,
            ":updatedAt": publishedAt
          },
          ReturnValues: "ALL_NEW"
        }));
      });

      return NextResponse.json({ item: result.Attributes });
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    if (!unauthorized) console.error(JSON.stringify({ event: "portal.api.publish.error", "error.type": error instanceof Error ? error.constructor.name : "UnknownError", "error.message": error instanceof Error ? error.message : String(error), "db.system": "dynamodb" }));
    return NextResponse.json({ error: unauthorized ? "Unauthorized" : "Unable to publish API" }, { status: unauthorized ? 401 : 500 });
  }
}
