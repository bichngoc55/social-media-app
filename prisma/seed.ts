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
    } else {
      // Promote existing user to admin
      await prisma.user.update({
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

    const admin = await prisma.user.create({
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
    console.log(`   ID: ${admin.id}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Display Name: ${admin.displayName}`);
    console.log(`   Role: ADMIN`);
    console.log();
  }

  console.log("📝 Admin Login Credentials:");
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Password: ${adminPassword}`);
  console.log();
  console.log("⚠️  WARNING: Change the default password in production!");
  console.log();
  console.log(
    "💡 Access admin dashboard at: http://localhost:3000/admin/dashboard"
  );
  console.log();
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
