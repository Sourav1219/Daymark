import type { Metadata } from "next"
import SignInPage from "../sign-in/page"

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Traketo account to access your tasks and focus timer.",
  alternates: { canonical: "/login" },
}

type LoginPageProps = Parameters<typeof SignInPage>[0]

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams
  return SignInPage({
    searchParams: Promise.resolve({
      ...searchParams,
      mode: "login",
    }),
  })
}
