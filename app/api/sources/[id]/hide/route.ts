import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  await prisma.userHiddenSource.upsert({
    where: {
      userId_feedSourceId: {
        userId: user.id,
        feedSourceId: id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      feedSourceId: id,
    },
  });

  return NextResponse.json({ hidden: true });
}
