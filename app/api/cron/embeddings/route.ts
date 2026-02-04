import { NextResponse } from "next/server";
import { computeArticleEmbeddings } from "@/lib/embeddings";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await computeArticleEmbeddings(50);

  return NextResponse.json(result);
}
