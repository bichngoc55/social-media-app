import { PrismaClient, UserRole, MediaType, PostPrivacy } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateIdFromEntropySize } from "lucia";

const prisma = new PrismaClient();

// Sample data arrays for generating dynamic content
const firstNames = [
  "Alex",
  "Sam",
  "Jordan",
  "Casey",
  "Taylor",
  "Morgan",
  "Riley",
  "Avery",
  "Quinn",
  "Blake",
  "Cameron",
  "Sage",
  "River",
  "Phoenix",
  "Skyler",
  "Rowan",
  "Emery",
  "Finley",
  "Hayden",
  "Indigo",
  "Kai",
  "Logan",
  "Nova",
  "Orion",
  "Parker",
  "Raven",
  "Scout",
  "Storm",
  "Vale",
  "Wren",
  "Zara",
  "Atlas",
  "Briar",
  "Cedar",
  "Delta",
  "Echo",
  "Fox",
  "Gray",
  "Hunter",
  "Ivy",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Martin",
  "Garcia",
  "Rodriguez",
  "Lewis",
  "Lee",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "King",
  "Wright",
  "Lopez",
  "Hill",
  "Scott",
  "Green",
  "Adams",
  "Baker",
  "Gonzalez",
  "Nelson",
  "Carter",
  "Mitchell",
  "Perez",
  "Roberts",
  "Turner",
  "Phillips",
  "Campbell",
  "Parker",
];

const postTemplates = [
  "Just finished working on an amazing project! {tech} is incredible 🚀",
  "Beautiful {weather} today! Perfect for {activity} ☀️",
  "Learning {skill} and loving every minute of it! 📚",
  "Coffee break thoughts: {thought} ☕",
  "Weekend vibes: {weekend_activity} 🌟",
  "Excited to share my latest {creation}! 🎉",
  "Morning motivation: {motivation} 💪",
  "Can't believe how fast {time_period} has gone by! ⏰",
  "Just discovered {discovery} and it's mind-blowing! 🤯",
  "Working on {work_project} and feeling inspired! ✨",
];

const techWords = [
  "React",
  "Next.js",
  "TypeScript",
  "Python",
  "JavaScript",
  "Vue",
  "Angular",
  "Node.js",
  "GraphQL",
  "Docker",
];
const weatherWords = [
  "sunny day",
  "rainy afternoon",
  "cloudy morning",
  "snowy evening",
  "windy day",
];
const activities = [
  "coding",
  "reading",
  "walking",
  "photography",
  "designing",
  "writing",
  "learning",
  "creating",
];
const skills = [
  "machine learning",
  "web development",
  "UI/UX design",
  "data science",
  "mobile development",
];
const thoughts = [
  "simplicity is key",
  "always keep learning",
  "collaboration makes everything better",
  "innovation starts with curiosity",
];
const weekendActivities = [
  "hiking with friends",
  "trying new recipes",
  "visiting museums",
  "playing board games",
  "gardening",
];
const creations = [
  "mobile app",
  "website design",
  "art piece",
  "blog post",
  "open source project",
];
const motivations = [
  "Every expert was once a beginner",
  "Progress over perfection",
  "Small steps lead to big changes",
];
const timeWords = [
  "this month",
  "the year",
  "this week",
  "the semester",
  "the quarter",
];
const discoveries = [
  "this amazing library",
  "a new design pattern",
  "an incredible book",
  "a helpful tool",
];
const workProjects = [
  "a new feature",
  "database optimization",
  "user interface redesign",
  "API integration",
];

const mediaUrls = [
  "https://utfs.io/a/eyJhcGlLZXkiOiJza19saXZlXzU3YmEyYWIxMmNhNjFmYmVkNjk0NzMwNzgzMjhmMjNjNTkyZGUzOWVkYzQ3NDI1MDVjMDM4YjBlYjAxYWJmMmMiLCJhcHBJZCI6Im56MGp0czhzdnMiLCJyZWdpb25zIjpbInNlYTEiXX0=/b582e5d8-c49f-4a7d-922f-08941adfe1b8-ws7inm.png",
  "https://utfs.io/a/eyJhcGlLZXkiOiJza19saXZlXzU3YmEyYWIxMmNhNjFmYmVkNjk0NzMwNzgzMjhmMjNjNTkyZGUzOWVkYzQ3NDI1MDVjMDM4YjBlYjAxYWJmMmMiLCJhcHBJZCI6Im56MGp0czhzdnMiLCJyZWdpb25zIjpbInNlYTEiXX0=/f8c2a1d9-b34e-4c6a-8f7d-12345abcdef0-image1.jpg",
  "https://utfs.io/a/eyJhcGlLZXkiOiJza19saXZlXzU3YmEyYWIxMmNhNjFmYmVkNjk0NzMwNzgzMjhmMjNjNTkyZGUzOWVkYzQ3NDI1MDVjMDM4YjBlYjAxYWJmMmMiLCJhcHBJZCI6Im56MGp0czhzdnMiLCJyZWdpb25zIjpbInNlYTEiXX0=/a3b4c5d6-e7f8-9101-1121-314151617181-nature.png",
  "https://utfs.io/a/eyJhcGlLZXkiOiJza19saXZlXzU3YmEyYWIxMmNhNjFmYmVkNjk0NzMwNzgzMjhmMjNjNTkyZGUzOWVkYzQ3NDI1MDVjMDM4YjBlYjAxYWJmMmMiLCJhcHBJZCI6Im56MGp0czhzdnMiLCJyZWdpb25zIjpbInNlYTEiXX0=/d4e5f6g7-h8i9-j101-k121-314151617181-tech.jpg",
  "https://utfs.io/a/eyJhcGlLZXkiOiJza19saXZlXzU3YmEyYWIxMmNhNjFmYmVkNjk0NzMwNzgzMjhmMjNjNTkyZGUzOWVkYzQ3NDI1MDVjMDM4YjBlYjAxYWJmMmMiLCJhcHBJZCI6Im56MGp0czhzdnMiLCJyZWdpb25zIjpbInNlYTEiXX0=/e5f6g7h8-i9j1-k121-l131-415161718192-coffee.png",
];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomUsername(firstName, lastName) {
  const variations = [
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}`,
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${Math.floor(Math.random() * 999)}`,
  ];
  return getRandomElement(variations);
}

function generatePostContent() {
  const template = getRandomElement(postTemplates);
  return template
    .replace("{tech}", getRandomElement(techWords))
    .replace("{weather}", getRandomElement(weatherWords))
    .replace("{activity}", getRandomElement(activities))
    .replace("{skill}", getRandomElement(skills))
    .replace("{thought}", getRandomElement(thoughts))
    .replace("{weekend_activity}", getRandomElement(weekendActivities))
    .replace("{creation}", getRandomElement(creations))
    .replace("{motivation}", getRandomElement(motivations))
    .replace("{time_period}", getRandomElement(timeWords))
    .replace("{discovery}", getRandomElement(discoveries))
    .replace("{work_project}", getRandomElement(workProjects));
}

function generateBio(firstName) {
  const bioTemplates = [
    `${firstName} | Software Developer | Coffee enthusiast`,
    `UI/UX Designer passionate about creating amazing experiences`,
    `Full-stack developer who loves clean code and good design`,
    `Tech enthusiast | Always learning something new`,
    `Creative developer building the future one line at a time`,
    `Designer & developer | Making the web more beautiful`,
    `Code by day, design by night | Creating digital experiences`,
    `Passionate about technology and human-centered design`,
  ];
  return getRandomElement(bioTemplates);
}

async function createUsers() {
  console.log("🔄 Creating 1000 new users...");

  const users = [];
  const batchSize = 50;

  for (let i = 0; i < 1000; i += batchSize) {
    const batch = [];

    for (let j = 0; j < batchSize && i + j < 1000; j++) {
      const firstName = getRandomElement(firstNames);
      const lastName = getRandomElement(lastNames);
      const username = generateRandomUsername(firstName, lastName);
      const email = `${username}@example${Math.floor(Math.random() * 10)}.com`;
      const displayName = `${firstName} ${lastName}`;
      const bio = generateBio(firstName);
      const passwordHash = await bcrypt.hash("password123", 12);
      const userId = generateIdFromEntropySize(10);

      batch.push({
        id: userId,
        username,
        displayName,
        email,
        passwordHash,
        emailVerified: true,
        bio,
        role: UserRole.USER,
      });
    }

    try {
      await prisma.user.createMany({
        data: batch,
        skipDuplicates: true,
      });
      users.push(...batch);
      console.log(
        `✅ Created users batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(1000 / batchSize)}`
      );
    } catch (error) {
      console.log(
        `⚠️ Some users in batch ${Math.floor(i / batchSize) + 1} already exist, skipping duplicates`
      );
    }
  }

  return users;
}

async function createMedia() {
  console.log("🔄 Creating media attachments...");

  const mediaData = [];

  for (let i = 0; i < 2000; i++) {
    mediaData.push({
      id: generateIdFromEntropySize(10),
      url: getRandomElement(mediaUrls),
      type: MediaType.IMAGE,
    });
  }

  await prisma.media.createMany({
    data: mediaData,
    skipDuplicates: true,
  });

  console.log("✅ Created 2000 media attachments");
  return mediaData;
}

async function createPostsWithMedia(
  users: { id: string; username: string; displayName: string }[],
  media: any[]
) {
  console.log("🔄 Creating 1000 posts with media and comments...");

  // Get all user IDs from database to ensure they exist
  const allUserIds = await prisma.user.findMany({
    select: { id: true },
  });

  const availableMedia = await prisma.media.findMany({
    where: {
      postId: null,
    },
    select: { id: true },
  });

  const batchSize = 25;

  for (let i = 0; i < 1000; i += batchSize) {
    const postBatch = [];

    for (let j = 0; j < batchSize && i + j < 1000; j++) {
      const user = getRandomElement(allUserIds);
      const content = generatePostContent();
      const privacy = getRandomElement([
        PostPrivacy.PUBLIC,
        PostPrivacy.FOLLOWERS,
        PostPrivacy.DRAFT,
      ]);
      const postId = generateIdFromEntropySize(10);

      postBatch.push({
        id: postId,
        content,
        userId: user.id,
        privacy,
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
      });
    }

    const createdPosts = await prisma.post.createMany({
      data: postBatch,
    });

    for (const post of postBatch) {
      const shouldHaveMedia = Math.random() > 0.3;

      if (shouldHaveMedia && availableMedia.length > 0) {
        const mediaCount = Math.floor(Math.random() * 3) + 1;
        const selectedMedia = [];

        for (let k = 0; k < mediaCount && availableMedia.length > 0; k++) {
          const mediaIndex = Math.floor(Math.random() * availableMedia.length);
          const mediaItem = availableMedia.splice(mediaIndex, 1)[0];
          selectedMedia.push(mediaItem.id);
        }

        if (selectedMedia.length > 0) {
          await prisma.media.updateMany({
            where: {
              id: { in: selectedMedia },
            },
            data: {
              postId: post.id,
            },
          });
        }
      }

      const commentCount = Math.floor(Math.random() * 8);
      const comments = [];

      for (let c = 0; c < commentCount; c++) {
        const commenter = getRandomElement(allUserIds);
        const commentContent = generatePostContent();

        comments.push({
          id: generateIdFromEntropySize(10),
          content: commentContent,
          userId: commenter.id,
          postId: post.id,
          createdAt: new Date(
            Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000
          ),
        });
      }

      if (comments.length > 0) {
        await prisma.comment.createMany({
          data: comments,
        });
      }

      const likeCount = Math.floor(Math.random() * 25);
      const likes = [];
      const usedUserIds = new Set();

      for (let l = 0; l < likeCount; l++) {
        const liker = getRandomElement(allUserIds);
        if (!usedUserIds.has(liker.id)) {
          usedUserIds.add(liker.id);
          likes.push({
            userId: liker.id,
            postId: post.id,
          });
        }
      }

      if (likes.length > 0) {
        await prisma.like.createMany({
          data: likes,
          skipDuplicates: true,
        });
      }

      const bookmarkCount = Math.floor(Math.random() * 10);
      const bookmarks = [];
      const usedBookmarkUserIds = new Set();

      for (let b = 0; b < bookmarkCount; b++) {
        const bookmarker = getRandomElement(allUserIds);
        if (!usedBookmarkUserIds.has(bookmarker.id)) {
          usedBookmarkUserIds.add(bookmarker.id);
          bookmarks.push({
            id: generateIdFromEntropySize(10),
            userId: bookmarker.id,
            postId: post.id,
            createdAt: new Date(),
          });
        }
      }

      if (bookmarks.length > 0) {
        await prisma.bookmark.createMany({
          data: bookmarks,
          skipDuplicates: true,
        });
      }
    }

    console.log(
      `✅ Created posts batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(1000 / batchSize)} with media and interactions`
    );
  }
}

async function createFollows(
  users: { id: string; username: string; displayName: string }[]
) {
  console.log("🔄 Creating follow relationships...");

  // Get all user IDs from database
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  const follows = [];

  for (const user of users) {
    const followCount = Math.floor(Math.random() * 50) + 5;
    const usedFollowingIds = new Set();

    for (let i = 0; i < followCount; i++) {
      const userToFollow = getRandomElement(allUsers);
      if (
        userToFollow.id !== user.id &&
        !usedFollowingIds.has(userToFollow.id)
      ) {
        usedFollowingIds.add(userToFollow.id);
        follows.push({
          followerId: user.id,
          followingId: userToFollow.id,
        });
      }
    }
  }

  await prisma.follow.createMany({
    data: follows,
    skipDuplicates: true,
  });

  console.log(`✅ Created ${follows.length} follow relationships`);
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Default admin credentials
  const adminUsername = "admin";
  const adminEmail = "admin@example.com";
  const adminPassword = "admin123"; // Change this in production!
  const adminDisplayName = "Administrator";

  let adminUser: any;

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ username: adminUsername }, { email: adminEmail }],
    },
  });

  if (existingAdmin) {
    if (existingAdmin.role === UserRole.ADMIN) {
      console.log("✅ Admin user already exists:");
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}\n`);
      adminUser = existingAdmin;
    } else {
      // Promote existing user to admin
      adminUser = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: UserRole.ADMIN },
      });
      console.log("✅ Updated existing user to ADMIN:");
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}\n`);
    }
  } else {
    // Create new admin user
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const userId = generateIdFromEntropySize(10);

    adminUser = await prisma.user.create({
      data: {
        id: userId,
        username: adminUsername,
        displayName: adminDisplayName,
        email: adminEmail,
        passwordHash,
        emailVerified: true, // Admin email is auto-verified
        role: UserRole.ADMIN,
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Display Name: ${adminUser.displayName}`);
    console.log(`   Role: ADMIN`);
    console.log();
  }

  // Create regular users (gautoi and bling)
  const specialUsers = [
    {
      username: "gautoi",
      email: "22520957@gm.uit.edu.vn",
      password: "123456789",
      displayName: "Gau Toi",
      bio: "Software developer who loves coding and coffee ☕",
    },
    {
      username: "bling",
      email: "22520757@gm.uit.edu.vn",
      password: "123456789",
      displayName: "Bling",
      bio: "UI/UX Designer passionate about creating beautiful experiences",
    },
  ];

  for (const userData of specialUsers) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: userData.username }, { email: userData.email }],
      },
    });

    if (existingUser) {
      console.log(`✅ User ${userData.username} already exists`);
    } else {
      const passwordHash = await bcrypt.hash(userData.password, 12);
      const userId = generateIdFromEntropySize(10);

      await prisma.user.create({
        data: {
          id: userId,
          username: userData.username,
          displayName: userData.displayName,
          email: userData.email,
          passwordHash,
          emailVerified: true,
          bio: userData.bio,
          role: UserRole.USER,
        },
      });

      console.log(`✅ Created user: ${userData.username}`);
    }
  }

  console.log("\n🚀 Starting dynamic data creation...\n");

  try {
    const existingUsers = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true },
    });

    console.log(`📊 Found ${existingUsers.length} existing users`);

    const newUsers = await createUsers();
    const allUsers = [...existingUsers, ...newUsers];

    const media = await createMedia();

    await createPostsWithMedia(allUsers, media);

    // Get fresh user list for follows to ensure we have valid IDs
    const allUsersForFollows = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true },
    });

    await createFollows(allUsersForFollows);

    const finalStats = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count(),
      prisma.like.count(),
      prisma.bookmark.count(),
      prisma.follow.count(),
      prisma.media.count(),
    ]);

    console.log("\n🎉 Dynamic data creation completed successfully!");
    console.log("📈 Final Statistics:");
    console.log(`   👥 Users: ${finalStats[0]}`);
    console.log(`   📝 Posts: ${finalStats[1]}`);
    console.log(`   💬 Comments: ${finalStats[2]}`);
    console.log(`   👍 Likes: ${finalStats[3]}`);
    console.log(`   🔖 Bookmarks: ${finalStats[4]}`);
    console.log(`   🤝 Follows: ${finalStats[5]}`);
    console.log(`   📷 Media: ${finalStats[6]}`);
  } catch (error) {
    console.error("❌ Error creating dynamic data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
