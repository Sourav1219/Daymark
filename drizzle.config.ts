import { defineConfig } from "drizzle-kit"

const production = process.env.NODE_ENV === "production"
const migrationDatabaseUrl = production
  ? (process.env.MIGRATION_DATABASE_URL ?? "")
  : (process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "")

if (production && !migrationDatabaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL is required in production")
}
if (production) {
  const runtimeDatabaseUrl = process.env.DATABASE_URL
  if (!runtimeDatabaseUrl) {
    throw new Error("DATABASE_URL is required in production")
  }
  if (
    new URL(runtimeDatabaseUrl).username ===
    new URL(migrationDatabaseUrl).username
  ) {
    throw new Error(
      "DATABASE_URL and MIGRATION_DATABASE_URL must use different roles",
    )
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationDatabaseUrl,
    ...(production ? { ssl: "verify-full" as const } : {}),
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
  strict: true,
  verbose: true,
})
