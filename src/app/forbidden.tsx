import Link from "next/link"

export default function Forbidden() {
  return (
    <main className="state-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <section aria-labelledby="forbidden-title">
        <p className="eyebrow">403 · Workspace denied</p>
        <h1 className="state-title" id="forbidden-title">
          This workspace is outside your access boundary.
        </h1>
        <p className="lede">No data from that workspace has been returned.</p>
        <Link className="health-link" href="/today">
          Return to Today
        </Link>
      </section>
    </main>
  )
}
