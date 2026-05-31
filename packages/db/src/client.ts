import { PrismaClient } from "../generated/client/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __memoryArchivePrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__memoryArchivePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__memoryArchivePrisma = prisma;
}

export type { Prisma } from "../generated/client/index.js";
export * from "../generated/client/index.js";
