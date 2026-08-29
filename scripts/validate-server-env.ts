import { serverEnvSchema } from "../src/lib/env/schema.ts"

const parsed = serverEnvSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n")
  console.error(`Server environment validation failed:\n${issues}`)
  process.exitCode = 1
}
