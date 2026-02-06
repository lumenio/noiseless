import { prisma } from "@/lib/db";
import { TopicPicker } from "@/components/onboarding/topic-picker";

export default async function OnboardingPage() {
  const topics = await prisma.topic.findMany({ orderBy: { label: "asc" } });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-heading tracking-tight">
          What are you interested in?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick at least 3 topics to personalize your feed. You can always change
          these later.
        </p>
      </div>
      <TopicPicker topics={topics} />
    </div>
  );
}
