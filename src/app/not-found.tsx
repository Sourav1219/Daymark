import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Compass, Home, Search } from "lucide-react"

export const metadata: Metadata = {
  description: "The page you are looking for does not exist or has been moved.",
  title: "Page Not Found",
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotFound() {
  return (
    <main className="unauth" role="main">
      {/* Decorative layers */}
      <div className="unauth__grid" aria-hidden="true" />

      <section aria-labelledby="not-found-title" className="unauth__stage">
        <div className="unauth__inner">
          {/* Top bar */}
          <header className="unauth__topbar">
            <Link className="unauth__wordmark" href="/" title="Traketo Home">
              <span className="unauth__diamond" aria-hidden="true" />
              <span>Traketo</span>
            </Link>

            <span className="unauth__status-pill" role="status">
              <span className="unauth__status-dot" aria-hidden="true" />
              <span>404 · Not Found</span>
            </span>
          </header>

          {/* Artwork */}
          <div className="unauth__art" aria-hidden="true">
            <div className="unauth__orb" />
            <div className="unauth__ring" />
            <div className="unauth__ring unauth__ring--inner" />

            <div className="unauth__chip unauth__chip--tl">
              <Compass aria-hidden="true" />
              <span>Off Track</span>
            </div>

            <div className="unauth__icon-box">
              <Search aria-hidden="true" />
            </div>

            <div className="unauth__chip unauth__chip--br">
              <Home aria-hidden="true" />
              <span>Safe Path</span>
            </div>
          </div>

          {/* Copy */}
          <div className="unauth__body">
            <p className="unauth__eyebrow">404 · Page Not Found</p>
            <h1 className="unauth__title" id="not-found-title">
              We can’t find that <em>page</em>.
            </h1>
            <p className="unauth__desc">
              The link you followed may be broken, or the page may have been
              moved. Your tasks, streaks, and account data remain completely
              safe.
            </p>
          </div>

          {/* Trust row */}
          <div className="unauth__trust">
            <div className="unauth__trust-icon" aria-hidden="true">
              <CheckCircle2 />
            </div>
            <span>Your workspace and tasks are safe and sound.</span>
          </div>

          {/* CTAs */}
          <div className="unauth__actions">
            <Link
              className="unauth__btn-primary"
              href="/today"
              id="not-found-today-btn"
              rel="nofollow"
            >
              <ArrowLeft aria-hidden="true" />
              <span>Back to your tasks</span>
            </Link>
            <Link className="unauth__btn-secondary" href="/">
              Back to homepage
            </Link>
          </div>

          {/* Footer */}
          <footer className="unauth__footer">
            <p className="unauth__footer-text">
              Need help?{" "}
              <Link className="unauth__footer-link" href="/contact">
                Contact support
              </Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  )
}
