import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const envFiles = [
  resolve(packageRoot, ".env"),
  resolve(packageRoot, "../../.env"),
  resolve(packageRoot, "../../apps/web/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
    break;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
