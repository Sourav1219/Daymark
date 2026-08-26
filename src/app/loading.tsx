export default function Loading() {
  return (
    <div className="app-stage">
      <main
        className="device-frame startup-loading-frame"
        aria-busy="true"
        aria-labelledby="startup-loading-title"
        aria-live="polite"
      >
        <header className="device-header startup-loading-header">
          <span aria-hidden="true" className="recovery-brand-mark">
            T
          </span>
          <span className="recovery-brand-name">Traketo</span>
          <span className="startup-loading-status">Starting</span>
        </header>

        <section className="startup-loading-content">
          <div aria-hidden="true" className="startup-loading-mark">
            <span />
            <span />
            <span />
          </div>
          <p className="startup-loading-eyebrow">Almost there</p>
          <h1 id="startup-loading-title">Preparing your day…</h1>
          <p className="startup-loading-description">
            Loading your tasks and focus space.
          </p>
          <div aria-hidden="true" className="startup-loading-track">
            <span />
          </div>
        </section>
      </main>
    </div>
  )
}
