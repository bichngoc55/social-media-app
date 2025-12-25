import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

let prisma: ReturnType<typeof prismaClientSingleton>;

// In development, ensure we have the latest Prisma client
if (process.env.NODE_ENV !== "production") {
  // Check if global instance exists and has all required models
  if (globalThis.prismaGlobal) {
    const globalPrisma = globalThis.prismaGlobal;
    // Check if all required models exist
    if (
      globalPrisma.moderationCase &&
      globalPrisma.userWarning &&
      globalPrisma.user
    ) {
      prisma = globalPrisma;
    } else {
      console.warn(
        "Prisma models missing. Clearing and recreating global instance..."
      );
      globalThis.prismaGlobal = undefined;
      prisma = prismaClientSingleton();
      globalThis.prismaGlobal = prisma;
    }
  } else {
    prisma = prismaClientSingleton();
    globalThis.prismaGlobal = prisma;
  }
} else {
  prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
}

export default prisma;
