import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  await prisma.userSourceSubscription.upsert({
    where: {
      userId_feedSourceId: {
        userId: session.user.id,
        feedSourceId: id,
      },
    },
    update: {},
    create: {
      userId: session.user.id,
      feedSourceId: id,
    },
  });

  return NextResponse.json({ subscribed: true });
}
