import { NextResponse } from "next/server";
import { ingestBatch } from "@/lib/ingest/ingestBatch";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ingestBatch();

  return NextResponse.json(result);
}
