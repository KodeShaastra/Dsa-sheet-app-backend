import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';
import { chapters, leetcodeUrl } from './seed-data.js';

const DEMO_USER = { email: 'demo@dsasheet.dev', name: 'Demo User', password: 'Demo@1234' };

// Safe to run many times: every row is upserted by a unique key
// (chapter slug, topic title within its chapter, problem title within its topic).
async function seedSheet() {
  let problemCount = 0;

  for (const [chapterIndex, c] of chapters.entries()) {
    const chapter = await prisma.chapter.upsert({
      where: { slug: c.slug },
      update: { title: c.title, displayOrder: chapterIndex + 1 },
      create: { slug: c.slug, title: c.title, displayOrder: chapterIndex + 1 },
    });

    for (const [topicIndex, t] of c.topics.entries()) {
      const topic = await prisma.topic.upsert({
        where: { chapterId_title: { chapterId: chapter.id, title: t.title } },
        update: { displayOrder: topicIndex + 1 },
        create: { chapterId: chapter.id, title: t.title, displayOrder: topicIndex + 1 },
      });

      for (const [problemIndex, [title, slug, difficulty]] of t.problems.entries()) {
        const data = { difficulty, practiceUrl: leetcodeUrl(slug), displayOrder: problemIndex + 1 };
        // youtubeUrl / articleUrl are not touched on update, so links added later are kept.
        await prisma.problem.upsert({
          where: { topicId_title: { topicId: topic.id, title } },
          update: data,
          create: { topicId: topic.id, title, ...data },
        });
        problemCount++;
      }
    }
  }

  return problemCount;
}

async function seedDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);
  await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: {},
    create: { email: DEMO_USER.email, name: DEMO_USER.name, passwordHash },
  });
}

async function main() {
  const problemCount = await seedSheet();
  await seedDemoUser();
  console.log(`Seeded ${chapters.length} chapters and ${problemCount} problems.`);
  console.log(`Demo user: ${DEMO_USER.email}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
