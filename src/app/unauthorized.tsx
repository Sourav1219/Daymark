import Link from "next/link"

export default function Unauthorized() {
  return (
    <main className="state-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <section aria-labelledby="unauthorized-title">
        <p className="eyebrow">401 · Authentication required</p>
        <h1 className="state-title" id="unauthorized-title">
          Your session is missing or expired.
        </h1>
        <p className="lede">Sign in again to enter your private workspace.</p>
        <Link className="health-link" href="/sign-in">
          Return to sign in
        </Link>
      </section>
    </main>
  )
}
