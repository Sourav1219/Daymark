import Link from "next/link"

export default function NotFound() {
  return (
    <main className="state-shell">
      <p className="eyebrow">Page not found</p>
      <h1 className="state-title">We can’t find that page.</h1>
      <Link className="health-link" href="/">
        Back to home
      </Link>
    </main>
  )
}
