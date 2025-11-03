import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log("🔌 Testing database connection...\n");

    // Display connection info (masked)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const url = new URL(dbUrl);
        console.log("📡 Connection Details:");
        console.log(`   Host: ${url.hostname}`);
        console.log(
          `   Port: ${url.port || (url.protocol === "postgresql:" ? "5432 (default)" : "N/A")}`
        );
        console.log(
          `   Database: ${url.pathname.replace("/", "") || "default"}`
        );
        console.log(`   User: ${url.username || "default"}`);
        console.log(
          `   Using SSL: ${url.searchParams.get("sslmode") === "require" ? "Yes" : "No"}`
        );
        console.log(
          `   Connection Type: ${url.searchParams.get("pgbouncer") === "true" ? "Pooler (pgbouncer)" : "Direct"}\n`
        );
      } catch (e) {
        console.log("   (Cannot parse DATABASE_URL)\n");
      }
    }

    // Test 1: Basic connection
    await prisma.$connect();
    console.log("✅ Database connection successful!\n");

    // Test 2: Query database
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);

    const postCount = await prisma.post.count();
    console.log(`📝 Total posts in database: ${postCount}\n`);

    // Test 3: Check database info
    const dbInfo = await prisma.$queryRaw<
      Array<{
        current_database: string;
        current_schema: string;
        current_user: string;
        version: string;
        inet_server_addr: string | null;
        inet_server_port: number | null;
      }>
    >`
      SELECT 
        current_database(),
        current_schema(),
        current_user,
        version(),
        inet_server_addr(),
        inet_server_port()
    `;

    console.log("🗄️  Database Information:");
    console.log(
      `   Database Name: ${dbInfo[0]?.current_database || "unknown"}`
    );
    console.log(`   Schema: ${dbInfo[0]?.current_schema || "unknown"}`);
    console.log(`   User: ${dbInfo[0]?.current_user || "unknown"}`);
    if (dbInfo[0]?.inet_server_addr) {
      console.log(`   Server IP: ${dbInfo[0].inet_server_addr}`);
      console.log(`   Server Port: ${dbInfo[0].inet_server_port}`);
    }
    if (dbInfo[0]?.version) {
      const pgVersion = dbInfo[0].version.match(/PostgreSQL (\d+\.\d+)/);
      if (pgVersion) {
        console.log(`   PostgreSQL Version: ${pgVersion[1]}`);
      }
    }
    console.log();

    // Test 4: Check if tables exist in public schema
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log(`📋 Tables in public schema (${tables.length}):`);
    tables.slice(0, 10).forEach((table) => {
      console.log(`   • ${table.table_name}`);
    });
    if (tables.length > 10) {
      console.log(`   ... and ${tables.length - 10} more`);
    }
    console.log();

    console.log("✅ All tests passed! Database is ready to use.");
  } catch (error) {
    console.error("❌ Database connection failed!\n");
    console.error("Error details:", error);

    if (error instanceof Error) {
      if (error.message.includes("P1001")) {
        console.error("\n🔍 Possible issues:");
        console.error("   • Database server is not reachable");
        console.error("   • Check if DATABASE_URL in .env is correct");
        console.error("   • Check if database server is running");
      } else if (error.message.includes("P1000")) {
        console.error("\n🔍 Possible issues:");
        console.error("   • Authentication failed");
        console.error("   • Check database username/password in DATABASE_URL");
      } else if (error.message.includes("does not exist")) {
        console.error("\n🔍 Possible issues:");
        console.error("   • Database name does not exist");
        console.error("   • Create the database first");
      }
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
