export default function Loading() {
  return (
    <div className="app-stage">
      <main className="state-shell" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Synchronizing system</p>
        <p className="state-title">Preparing the agenda…</p>
      </main>
    </div>
  )
}
