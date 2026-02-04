import { publicFeed } from "@/lib/public-feed";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic") || undefined;
  const cursor = searchParams.get("cursor") || undefined;

  const result = await publicFeed(topic, cursor);

  return NextResponse.json(result);
}
