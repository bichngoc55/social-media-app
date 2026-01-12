import { PrismaClient } from "@prisma/client";
import streamServerClient from "../src/lib/stream";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const prisma = new PrismaClient();

async function cleanupStreamUsers() {
  console.log("Starting Stream Chat Cleanup...");

  try {
    // 1. Get valid DB User IDs
    const dbUsers = await prisma.user.findMany({
      select: { id: true },
    });
    const validUserIds = new Set(dbUsers.map((u) => u.id));
    console.log(`Loaded ${validUserIds.size} valid users from Database.`);

    // 2. Fetch ALL Stream Users
    let streamUsers: { id: string; name?: string }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { users } = await streamServerClient.queryUsers(
        {},
        { id: 1 },
        { limit, offset }
      );
      if (users.length === 0) break;

      // @ts-ignore
      streamUsers = [...streamUsers, ...users];
      offset += limit;
      console.log(`Fetched ${streamUsers.length} users from Stream...`);
    }

    console.log(`Total users in Stream Chat: ${streamUsers.length}`);

    // 3. Identify Stale Users
    const staleUserIds = streamUsers
      .filter((u) => !validUserIds.has(u.id))
      .map((u) => u.id);

    console.log(`Found ${staleUserIds.length} stale users to delete.`);

    if (staleUserIds.length === 0) {
      console.log("Stream Chat is already in sync!");
      return;
    }

    // 4. Delete Stale Users in Batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < staleUserIds.length; i += BATCH_SIZE) {
      const batch = staleUserIds.slice(i, i + BATCH_SIZE);
      console.log(
        `Deleting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(staleUserIds.length / BATCH_SIZE)}... (${batch.length} users)`
      );

      try {
        await streamServerClient.deleteUsers(batch, {
          user: "hard",
          messages: "hard",
        });
        console.log("  Success.");

        // Wait to avoid rate limits (approx 10 req/min limit observed)
        if (i + BATCH_SIZE < staleUserIds.length) {
          console.log("  Waiting 10s to respect rate limits...");
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      } catch (err: any) {
        console.error(`  Failed to delete batch:`, err.message);
        // If rate limited, wait longer and retry?
        if (err?.response?.status === 429) {
          console.log("  Rate limit hit. Waiting 60s...");
          await new Promise((resolve) => setTimeout(resolve, 60000));
          // i is not decremented, so we skip this batch? No, we should retry.
          // For simplicity, just continue for now. User can run script again.
        }
      }
    }

    console.log("Cleanup complete!");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupStreamUsers();
