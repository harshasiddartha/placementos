import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** True when this process’s cached client includes all current schema delegates. */
function clientHasCurrentModels(client: PrismaClient): boolean {
  return (
    typeof (client as unknown as { onboardingQuestion?: { findMany: unknown } })
      .onboardingQuestion !== "undefined"
  );
}

const cached = globalForPrisma.prisma;
let prisma: PrismaClient;

if (cached && clientHasCurrentModels(cached)) {
  prisma = cached;
} else {
  if (cached && process.env.NODE_ENV !== "production") {
    void cached.$disconnect().catch(() => {});
  }
  prisma = createPrismaClient();
  globalForPrisma.prisma = prisma;
}

export { prisma };
