import { serverEnvSchema } from "../src/lib/env/schema.ts"

// This script runs before `next build` and `next start`, so Next.js has not
// assigned its production NODE_ENV yet. Validate the environment those
// commands will actually use instead of falling back to the schema's
// development default.
const parsed = serverEnvSchema.safeParse({
  ...process.env,
  NODE_ENV: "production",
})

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n")
  console.error(`Server environment validation failed:\n${issues}`)
  process.exitCode = 1
}
