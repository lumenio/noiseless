import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestions = await prisma.feedSuggestion.findMany({
    where: { suggestedByUserId: user.id },
    include: { topics: { include: { topic: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ suggestions });
}
