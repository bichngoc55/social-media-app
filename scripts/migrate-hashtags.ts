import prisma from "@/lib/prisma";

async function migrateHashtags() {
  console.log("Starting hashtag migration...");

  const posts = await prisma.post.findMany({
    where: {
      OR: [{ hashtags: { isEmpty: true } }, { hashtags: null as any }],
    },
    select: {
      id: true,
      content: true,
    },
  });

  console.log(`Found ${posts.length} posts to migrate`);

  let updated = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      const hashtagRegex = /#(\w+)/g;
      const hashtags: string[] = [];
      let match;

      while ((match = hashtagRegex.exec(post.content)) !== null) {
        hashtags.push(match[1].toLowerCase());
      }

      const uniqueHashtags = [...new Set(hashtags)];

      if (uniqueHashtags.length > 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: { hashtags: uniqueHashtags },
        });
        updated++;
        console.log(
          `Updated post ${post.id} with hashtags: ${uniqueHashtags.join(", ")}`
        );
      }
    } catch (error) {
      console.error(`Error updating post ${post.id}:`, error);
      errors++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Updated: ${updated} posts`);
  console.log(`Errors: ${errors} posts`);
  console.log(
    `Skipped: ${posts.length - updated - errors} posts (no hashtags)`
  );
}

migrateHashtags()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
