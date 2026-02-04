import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import feeds from "../data/feeds.json";

const connectionString =
  process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TOPICS = [
  { slug: "ai", label: "AI" },
  { slug: "robotics", label: "Robotics" },
  { slug: "biology", label: "Biology" },
  { slug: "neuroscience", label: "Neuroscience" },
  { slug: "security", label: "Security" },
  { slug: "programming", label: "Programming" },
  { slug: "startups", label: "Startups" },
  { slug: "math", label: "Math" },
  { slug: "design", label: "Design" },
  { slug: "geopolitics", label: "Geopolitics" },
  { slug: "economics", label: "Economics" },
  { slug: "climate", label: "Climate" },
  { slug: "hardware", label: "Hardware" },
  { slug: "data", label: "Data" },
];

async function main() {
  console.log("Seeding topics...");
  const topicMap = new Map<string, string>();

  for (const topic of TOPICS) {
    const t = await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { label: topic.label },
      create: topic,
    });
    topicMap.set(t.slug, t.id);
  }
  console.log(`  ${TOPICS.length} topics upserted`);

  console.log("Seeding feed sources...");
  let created = 0;

  for (const feed of feeds) {
    const source = await prisma.feedSource.upsert({
      where: { url: feed.url },
      update: {
        title: feed.title,
        siteUrl: feed.siteUrl,
        description: feed.description,
      },
      create: {
        title: feed.title,
        url: feed.url,
        siteUrl: feed.siteUrl,
        description: feed.description,
        isPreinstalled: true,
      },
    });

    for (const topicSlug of feed.topics) {
      const topicId = topicMap.get(topicSlug);
      if (!topicId) {
        console.warn(`  Warning: topic "${topicSlug}" not found`);
        continue;
      }
      await prisma.feedSourceTopic.upsert({
        where: {
          feedSourceId_topicId: {
            feedSourceId: source.id,
            topicId,
          },
        },
        update: {},
        create: {
          feedSourceId: source.id,
          topicId,
        },
      });
    }
    created++;
  }
  console.log(`  ${created} feed sources upserted`);

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
