import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
});

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if(process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}