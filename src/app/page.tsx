import { redirect } from "next/navigation"

// The proxy performs the optimistic cookie redirect to /today. Keeping this
// fallback request-independent lets anonymous root requests avoid a database
// session lookup and allows Next.js to prerender the route.
export default function HomePage() {
  redirect("/sign-in")
}
