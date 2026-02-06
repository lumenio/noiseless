import { getAuthUser } from "@/lib/auth";
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
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const dwellSeconds = parsed.success ? parsed.data.dwellSeconds : undefined;

  await recordInteraction(user.id, id, "OPEN", dwellSeconds);

  return NextResponse.json({ ok: true });
}
