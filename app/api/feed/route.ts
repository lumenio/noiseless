import { getAuthUser } from "@/lib/auth";
import { rankFeed } from "@/lib/rank";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || undefined;

  const result = await rankFeed(user.id, cursor);

  return NextResponse.json(result);
}
