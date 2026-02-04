import { auth } from "@/lib/auth";
import { recordInteraction } from "@/lib/interactions";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await recordInteraction(session.user.id, id, "SAVE");

  return NextResponse.json({ ok: true });
}
