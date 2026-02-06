import { getAuthUser } from "@/lib/auth";
import { recordInteraction } from "@/lib/interactions";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await recordInteraction(user.id, id, "HIDE");

  return NextResponse.json({ ok: true });
}
