import { auth } from "@/lib/auth";
import { recordInteraction } from "@/lib/interactions";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  dwellSeconds: z.number().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const dwellSeconds = parsed.success ? parsed.data.dwellSeconds : undefined;

  await recordInteraction(session.user.id, id, "OPEN", dwellSeconds);

  return NextResponse.json({ ok: true });
}
