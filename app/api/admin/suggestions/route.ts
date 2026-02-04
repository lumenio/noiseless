import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "PENDING";

  const suggestions = await prisma.feedSuggestion.findMany({
    where: { status: status as "PENDING" | "APPROVED" | "REJECTED" },
    include: {
      suggestedBy: { select: { email: true } },
      topics: { include: { topic: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ suggestions });
}
