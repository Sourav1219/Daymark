"use client"

import "./globals.css"

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string }
  reset: () => void
  retry?: () => void
}>

export default function GlobalError({ reset, retry }: GlobalErrorProps) {
  const recover = retry ?? reset

  return (
    <html className="recovery-document" lang="en">
      <head>
        <title>Traketo needs a moment</title>
        <meta
          content="width=device-width, initial-scale=1, viewport-fit=cover"
          name="viewport"
        />
        <meta content="#eaf1fe" name="theme-color" />
      </head>
      <body className="recovery-body">
        <main className="app-stage recovery-stage" role="alert">
          <section
            aria-labelledby="recovery-title"
            className="device-frame recovery-frame"
          >
            <header className="device-header recovery-header">
              <span aria-hidden="true" className="recovery-brand-mark">
                T
              </span>
              <span className="recovery-brand-name">Traketo</span>
              <span className="recovery-status">Interrupted</span>
            </header>

            <div className="recovery-content">
              <div aria-hidden="true" className="recovery-icon">
                <span>!</span>
              </div>
              <p className="recovery-eyebrow">Connection interrupted</p>
              <h1 id="recovery-title">Traketo needs a moment.</h1>
              <p className="recovery-description">
                The app couldn’t finish loading. Your saved tasks are still
                safe, and a quick retry usually gets everything moving again.
              </p>

              <div className="recovery-actions">
                <button
                  className="recovery-button recovery-button-primary"
                  onClick={recover}
                  type="button"
                >
                  Try again
                </button>
                <button
                  className="recovery-button recovery-button-secondary"
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  Reload app
                </button>
              </div>

              <p className="recovery-hint">
                If this keeps happening, check your connection and try once
                more.
              </p>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
