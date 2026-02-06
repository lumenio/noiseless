import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      onboardingCompletedAt: true,
      createdAt: true,
      _count: {
        select: {
          sourceSubscriptions: true,
          interactions: true,
        },
      },
    },
  });

  return NextResponse.json({ user: fullUser });
}
