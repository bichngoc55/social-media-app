import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateIdFromEntropySize } from "lucia";

const prisma = new PrismaClient();

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
    if (existingAdmin.role === "ADMIN") {
      console.log("✅ Admin user already exists:");
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}\n`);
      adminUser = existingAdmin;
    } else {
      // Promote existing user to admin
      adminUser = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: "ADMIN" } as any,
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
        role: "ADMIN" as any,
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

  // Create regular users
  const users = [
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

  const createdUsers = [];

  for (const userData of users) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: userData.username }, { email: userData.email }],
      },
    });

    if (existingUser) {
      createdUsers.push(existingUser);
    } else {
      const passwordHash = await bcrypt.hash(userData.password, 12);
      const userId = generateIdFromEntropySize(10);

      const user = await prisma.user.create({
        data: {
          id: userId,
          username: userData.username,
          displayName: userData.displayName,
          email: userData.email,
          passwordHash,
          emailVerified: true,
          bio: userData.bio,
          role: "USER" as any,
        },
      });

      createdUsers.push(user);
      console.log(`✅ Created user: ${user.username} (${user.email})`);
    }
  }

  // Create posts
  const posts = [
    {
      content:
        "Hello everyone! Just joined this amazing platform. Excited to share my journey in software development! �",
      userId: createdUsers[0].id,
    },
    {
      content:
        "Working on a new React project today. The component architecture is coming together nicely. Love how hooks make everything so clean! #React #JavaScript",
      userId: createdUsers[0].id,
    },
    {
      content:
        "Beautiful sunset today! Sometimes you need to step away from the screen and appreciate nature 🌅",
      userId: createdUsers[0].id,
    },
    {
      content:
        "Design inspiration: Sometimes the best solutions are the simplest ones. Less is more! ✨ #Design #UX",
      userId: createdUsers[1].id,
    },
    {
      content:
        "Just finished reading 'The Design of Everyday Things'. Such an eye-opening book about user-centered design principles! Highly recommend 📚",
      userId: createdUsers[1].id,
    },
    {
      content:
        "Coffee break thoughts: Why do we always overthink the simple things? Maybe it's time to embrace minimalism in design and code 🤔",
      userId: createdUsers[1].id,
    },
    {
      content:
        "Welcome to our community! Great to have more talented people joining us. Looking forward to seeing what amazing things you'll build! 🎉",
      userId: adminUser.id,
    },
  ];

  const createdPosts = [];

  for (const postData of posts) {
    const post = await prisma.post.create({
      data: {
        content: postData.content,
        userId: postData.userId,
        privacy: "PUBLIC" as any,
      },
    });
    createdPosts.push(post);
  }

  // Create comments
  const comments = [
    {
      content:
        "Welcome to the community! Looking forward to your contributions! 👋",
      userId: createdUsers[1].id,
      postId: createdPosts[0].id,
    },
    {
      content:
        "React hooks are indeed amazing! Have you tried the new Suspense features?",
      userId: createdUsers[1].id,
      postId: createdPosts[1].id,
    },
    {
      content: "Thank you! Happy to be here 😊",
      userId: createdUsers[0].id,
      postId: createdPosts[0].id,
    },
    {
      content:
        "Absolutely! Hooks changed everything about how I write React components. So much cleaner than class components.",
      userId: adminUser.id,
      postId: createdPosts[1].id,
    },
    {
      content:
        "Nature photography is such a great hobby! Do you have any tips for beginners?",
      userId: createdUsers[1].id,
      postId: createdPosts[2].id,
    },
    {
      content:
        "Couldn't agree more! Simplicity in design creates the best user experiences.",
      userId: createdUsers[0].id,
      postId: createdPosts[3].id,
    },
    {
      content:
        "That book is a classic! Don Norman's insights are timeless. Have you read 'Don't Make Me Think' by Steve Krug?",
      userId: createdUsers[0].id,
      postId: createdPosts[4].id,
    },
    {
      content:
        "So true! Sometimes I spend hours on something that could be solved in 5 minutes with a simpler approach 😅",
      userId: adminUser.id,
      postId: createdPosts[5].id,
    },
    {
      content:
        "Thanks for the warm welcome! Excited to contribute and learn from everyone here! 🙏",
      userId: createdUsers[0].id,
      postId: createdPosts[6].id,
    },
    {
      content:
        "This community already feels so welcoming! Can't wait to share some projects I'm working on.",
      userId: createdUsers[1].id,
      postId: createdPosts[6].id,
    },
  ];

  for (const commentData of comments) {
    await prisma.comment.create({
      data: {
        content: commentData.content,
        userId: commentData.userId,
        postId: commentData.postId,
      },
    });
  }

  // Create some likes
  const likes = [
    { userId: createdUsers[0].id, postId: createdPosts[3].id },
    { userId: createdUsers[0].id, postId: createdPosts[4].id },
    { userId: createdUsers[0].id, postId: createdPosts[6].id },
    { userId: createdUsers[1].id, postId: createdPosts[0].id },
    { userId: createdUsers[1].id, postId: createdPosts[1].id },
    { userId: createdUsers[1].id, postId: createdPosts[2].id },
    { userId: adminUser.id, postId: createdPosts[0].id },
    { userId: adminUser.id, postId: createdPosts[3].id },
    { userId: adminUser.id, postId: createdPosts[4].id },
  ];

  for (const likeData of likes) {
    try {
      await prisma.like.create({
        data: {
          userId: likeData.userId,
          postId: likeData.postId,
        },
      });
    } catch (error) {
      // Skip if like already exists
    }
  }

  // Create some follows
  const follows = [
    { followerId: createdUsers[0].id, followingId: createdUsers[1].id },
    { followerId: createdUsers[1].id, followingId: createdUsers[0].id },
    { followerId: createdUsers[0].id, followingId: adminUser.id },
    { followerId: createdUsers[1].id, followingId: adminUser.id },
  ];

  for (const followData of follows) {
    try {
      await prisma.follow.create({
        data: {
          followerId: followData.followerId,
          followingId: followData.followingId,
        },
      });
    } catch (error) {
      // Skip if follow relationship already exists
    }
  }

  // Create bookmarks for each user
  const bookmarks = [
    // gautoi bookmarks
    { userId: createdUsers[0].id, postId: createdPosts[3].id }, // Design inspiration post
    { userId: createdUsers[0].id, postId: createdPosts[4].id }, // Design book post
    { userId: createdUsers[0].id, postId: createdPosts[6].id }, // Welcome post

    // bling bookmarks
    { userId: createdUsers[1].id, postId: createdPosts[0].id }, // Hello post
    { userId: createdUsers[1].id, postId: createdPosts[1].id }, // React project post
    { userId: createdUsers[1].id, postId: createdPosts[2].id }, // Sunset post

    // admin bookmarks
    { userId: adminUser.id, postId: createdPosts[0].id }, // Hello post
    { userId: adminUser.id, postId: createdPosts[3].id }, // Design inspiration post
  ];

  for (const bookmarkData of bookmarks) {
    try {
      await prisma.bookmark.create({
        data: {
          userId: bookmarkData.userId,
          postId: bookmarkData.postId,
        },
      });
    } catch (error) {
      // Skip if bookmark already exists
    }
  }

  // Create notifications based on the interactions
  const notifications = [
    // Notifications for follows
    {
      recipientId: createdUsers[1].id, // bling receives notification
      issuerId: createdUsers[0].id, // gautoi follows bling
      type: "FOLLOW" as any,
    },
    {
      recipientId: createdUsers[0].id, // gautoi receives notification
      issuerId: createdUsers[1].id, // bling follows gautoi
      type: "FOLLOW" as any,
    },
    {
      recipientId: adminUser.id, // admin receives notification
      issuerId: createdUsers[0].id, // gautoi follows admin
      type: "FOLLOW" as any,
    },
    {
      recipientId: adminUser.id, // admin receives notification
      issuerId: createdUsers[1].id, // bling follows admin
      type: "FOLLOW" as any,
    },

    // Notifications for likes
    {
      recipientId: createdUsers[1].id, // bling receives notification (owner of design post)
      issuerId: createdUsers[0].id, // gautoi liked the post
      postId: createdPosts[3].id, // Design inspiration post
      type: "LIKE" as any,
    },
    {
      recipientId: createdUsers[1].id, // bling receives notification (owner of book post)
      issuerId: createdUsers[0].id, // gautoi liked the post
      postId: createdPosts[4].id, // Design book post
      type: "LIKE" as any,
    },
    {
      recipientId: createdUsers[0].id, // gautoi receives notification (owner of hello post)
      issuerId: createdUsers[1].id, // bling liked the post
      postId: createdPosts[0].id, // Hello post
      type: "LIKE" as any,
    },
    {
      recipientId: createdUsers[0].id, // gautoi receives notification (owner of react post)
      issuerId: createdUsers[1].id, // bling liked the post
      postId: createdPosts[1].id, // React project post
      type: "LIKE" as any,
    },

    // Notifications for comments
    {
      recipientId: createdUsers[0].id, // gautoi receives notification (owner of hello post)
      issuerId: createdUsers[1].id, // bling commented
      postId: createdPosts[0].id, // Hello post
      type: "COMMENT" as any,
    },
    {
      recipientId: createdUsers[0].id, // gautoi receives notification (owner of react post)
      issuerId: createdUsers[1].id, // bling commented
      postId: createdPosts[1].id, // React project post
      type: "COMMENT" as any,
    },
    {
      recipientId: createdUsers[0].id, // gautoi receives notification (owner of sunset post)
      issuerId: createdUsers[1].id, // bling commented
      postId: createdPosts[2].id, // Sunset post
      type: "COMMENT" as any,
    },
    {
      recipientId: createdUsers[1].id, // bling receives notification (owner of design post)
      issuerId: createdUsers[0].id, // gautoi commented
      postId: createdPosts[3].id, // Design inspiration post
      type: "COMMENT" as any,
    },
    {
      recipientId: createdUsers[1].id, // bling receives notification (owner of book post)
      issuerId: createdUsers[0].id, // gautoi commented
      postId: createdPosts[4].id, // Design book post
      type: "COMMENT" as any,
    },
    {
      recipientId: adminUser.id, // admin receives notification (owner of welcome post)
      issuerId: createdUsers[0].id, // gautoi commented
      postId: createdPosts[6].id, // Welcome post
      type: "COMMENT" as any,
    },
    {
      recipientId: adminUser.id, // admin receives notification (owner of welcome post)
      issuerId: createdUsers[1].id, // bling commented
      postId: createdPosts[6].id, // Welcome post
      type: "COMMENT" as any,
    },
  ];

  for (const notificationData of notifications) {
    try {
      await prisma.notification.create({
        data: {
          recipientId: notificationData.recipientId,
          issuerId: notificationData.issuerId,
          postId: notificationData.postId || null,
          type: notificationData.type,
          read: Math.random() > 0.7, // Randomly mark some as read (30% chance)
        },
      });
    } catch (error) {
      // Skip if notification already exists
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
