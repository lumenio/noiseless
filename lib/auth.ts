import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";

export async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return ensureUser(userId);
}

async function ensureUser(clerkId: string) {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  return prisma.user.upsert({
    where: { id: clerkId },
    update: { lastActiveAt: new Date() },
    create: {
      id: clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: clerkUser.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
        : null,
      image: clerkUser.imageUrl,
    },
  });
}
