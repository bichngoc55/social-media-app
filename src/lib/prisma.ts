import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// In development, ensure we have the latest Prisma client
if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;

  // Force check for ModerationCase model
  if (!prisma.moderationCase) {
    console.warn(
      "ModerationCase model not found. Clearing global Prisma instance..."
    );
    globalThis.prismaGlobal = undefined;
    // This will be recreated on next import
  }
}

export default prisma;
