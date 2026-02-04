import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  reviewNote: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const reviewNote = parsed.success ? parsed.data.reviewNote : undefined;

  await prisma.feedSuggestion.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  return NextResponse.json({ ok: true });
}
